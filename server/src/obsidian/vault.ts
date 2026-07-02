import fs from "node:fs";
import path from "node:path";
import { getConfig } from "../config.js";

export interface VaultEntry {
  name: string;
  path: string; // relative to vault root, forward slashes
  type: "folder" | "note";
  children?: VaultEntry[];
  mtimeMs?: number;
}

const SEED_FOLDERS = ["Daily", "Skill Runs", "Research", "Dashboards"];

/** Make the folder a real Obsidian vault (`.obsidian/` present) with our structure. */
export function ensureVault(): void {
  const root = getConfig().vaultPath;
  fs.mkdirSync(path.join(root, ".obsidian"), { recursive: true });
  const appJson = path.join(root, ".obsidian", "app.json");
  if (!fs.existsSync(appJson)) fs.writeFileSync(appJson, "{}\n", "utf8");
  for (const f of SEED_FOLDERS) fs.mkdirSync(path.join(root, f), { recursive: true });
  const home = path.join(root, "Home.md");
  if (!fs.existsSync(home)) {
    fs.writeFileSync(
      home,
      [
        "# AgentOS Vault",
        "",
        "Notes filed by [AgentOS](https://localhost:4311) skills:",
        "",
        "- `Daily/` — daily briefings (what you worked on, per project)",
        "- `Skill Runs/` — run logs and outputs",
        "- `Research/` — web research digests with sources",
        "- `Dashboards/` — exported metric summaries",
        "",
      ].join("\n"),
      "utf8",
    );
  }
}

/** Resolve a vault-relative path, refusing traversal outside the vault. */
export function safeVaultPath(rel: string): string {
  const root = getConfig().vaultPath;
  const resolved = path.resolve(root, rel);
  if (!resolved.toLowerCase().startsWith(root.toLowerCase() + path.sep) && resolved.toLowerCase() !== root.toLowerCase()) {
    throw new Error("path escapes vault");
  }
  return resolved;
}

export function vaultTree(): VaultEntry[] {
  const root = getConfig().vaultPath;
  const walk = (dir: string, relBase: string): VaultEntry[] => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const out: VaultEntry[] = [];
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const rel = relBase ? `${relBase}/${e.name}` : e.name;
      if (e.isDirectory()) {
        out.push({ name: e.name, path: rel, type: "folder", children: walk(path.join(dir, e.name), rel) });
      } else if (e.name.endsWith(".md")) {
        const mtimeMs = fs.statSync(path.join(dir, e.name)).mtimeMs;
        out.push({ name: e.name.replace(/\.md$/, ""), path: rel, type: "note", mtimeMs });
      }
    }
    return out.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1,
    );
  };
  return walk(root, "");
}

export function readNote(rel: string): { path: string; content: string; mtimeMs: number } {
  const full = safeVaultPath(rel);
  return {
    path: rel,
    content: fs.readFileSync(full, "utf8"),
    mtimeMs: fs.statSync(full).mtimeMs,
  };
}
