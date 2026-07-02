import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { getConfig, repoRoot } from "./config.js";
import { createApi } from "./api.js";
import { resolveApproval } from "./agent/runner.js";
import { ensureVault } from "./obsidian/vault.js";
import { scanSessions } from "./metrics/store.js";

const cfg = getConfig();
ensureVault();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

function broadcast(msg: unknown): void {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    try {
      const msg = JSON.parse(String(raw));
      if (msg.type === "approval_response" && typeof msg.requestId === "string") {
        resolveApproval(msg.requestId, msg.behavior === "allow");
      }
    } catch {
      // ignore malformed client messages
    }
  });
});

app.use("/api", createApi(broadcast));

// serve the built frontend when it exists (production mode); Vite proxies in dev
const webDist = path.join(repoRoot, "web", "dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("/*splat", (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

server.listen(cfg.serverPort, () => {
  console.log(`[agentos] server on http://localhost:${cfg.serverPort}  (ws: /ws)`);
  // warm the metrics cache in the background so the first dashboard load is fast
  void scanSessions().then((s) => console.log(`[agentos] metrics warm: ${s.length} sessions`));
});
