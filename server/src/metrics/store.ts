import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { getConfig, repoRoot } from "../config.js";
import { estimateCostUSD, type Usage } from "./pricing.js";

export interface SessionStats {
  sessionId: string;
  project: string; // folder name under projectsRoot, or cwd basename
  cwd: string;
  isAgentOS: boolean; // spawned by this dashboard — excluded from "my work" analytics
  firstTs: number;
  lastTs: number;
  userPrompts: number;
  assistantMsgs: number;
  usage: Usage;
  costUSD: number;
  toolCounts: Record<string, number>;
  models: string[];
  costByModel: Record<string, number>;
}

interface FileCacheEntry {
  mtimeMs: number;
  size: number;
  stats: SessionStats | null;
}

const fileCache = new Map<string, FileCacheEntry>();

function emptyUsage(): Usage {
  return { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
}

async function parseSessionFile(file: string): Promise<SessionStats | null> {
  const stats: SessionStats = {
    sessionId: path.basename(file, ".jsonl"),
    project: "",
    cwd: "",
    isAgentOS: false,
    firstTs: 0,
    lastTs: 0,
    userPrompts: 0,
    assistantMsgs: 0,
    usage: emptyUsage(),
    costUSD: 0,
    toolCounts: {},
    models: [],
    costByModel: {},
  };
  const models = new Set<string>();

  const rl = readline.createInterface({
    input: fs.createReadStream(file, "utf8"),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.startsWith("{")) continue;
    let ev: any;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    if (ev == null || typeof ev !== "object") continue;

    const ts = typeof ev.timestamp === "string" ? Date.parse(ev.timestamp) : NaN;
    if (!Number.isNaN(ts)) {
      if (!stats.firstTs) stats.firstTs = ts;
      stats.lastTs = Math.max(stats.lastTs, ts);
    }
    if (typeof ev.cwd === "string" && !stats.cwd) stats.cwd = ev.cwd;

    if (ev.type === "user" && !ev.isSidechain && ev.message?.role === "user") {
      // count only human-typed prompts, not tool results
      if (typeof ev.message.content === "string" || ev.origin?.kind === "human") {
        stats.userPrompts++;
      }
    } else if (ev.type === "assistant" && ev.message) {
      stats.assistantMsgs++;
      const model = typeof ev.message.model === "string" ? ev.message.model : "unknown";
      models.add(model);
      const u = ev.message.usage;
      if (u) {
        const delta: Usage = {
          input: u.input_tokens ?? 0,
          output: u.output_tokens ?? 0,
          cacheWrite: u.cache_creation_input_tokens ?? 0,
          cacheRead: u.cache_read_input_tokens ?? 0,
        };
        stats.usage.input += delta.input;
        stats.usage.output += delta.output;
        stats.usage.cacheWrite += delta.cacheWrite;
        stats.usage.cacheRead += delta.cacheRead;
        const cost = estimateCostUSD(model, delta);
        stats.costUSD += cost;
        stats.costByModel[model] = (stats.costByModel[model] ?? 0) + cost;
      }
      const content = ev.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "tool_use" && typeof block.name === "string") {
            stats.toolCounts[block.name] = (stats.toolCounts[block.name] ?? 0) + 1;
          }
        }
      }
    }
  }

  if (!stats.firstTs) return null; // metadata-only file, nothing to chart
  stats.models = [...models];
  const cwdLower = stats.cwd.toLowerCase();
  stats.isAgentOS = cwdLower.startsWith(repoRoot.toLowerCase());
  stats.project = stats.cwd ? path.basename(stats.cwd) : "unknown";
  return stats;
}

export async function scanSessions(): Promise<SessionStats[]> {
  const projectsDir = path.join(getConfig().claudeHome, "projects");
  const out: SessionStats[] = [];
  let dirs: string[] = [];
  try {
    dirs = fs.readdirSync(projectsDir);
  } catch {
    return out;
  }
  for (const dir of dirs) {
    const full = path.join(projectsDir, dir);
    let files: string[] = [];
    try {
      files = fs.readdirSync(full).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const f of files) {
      const file = path.join(full, f);
      let st: fs.Stats;
      try {
        st = fs.statSync(file);
      } catch {
        continue;
      }
      const cached = fileCache.get(file);
      if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
        if (cached.stats) out.push(cached.stats);
        continue;
      }
      const stats = await parseSessionFile(file).catch(() => null);
      fileCache.set(file, { mtimeMs: st.mtimeMs, size: st.size, stats });
      if (stats) out.push(stats);
    }
  }
  return out;
}
