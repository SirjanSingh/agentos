import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface AgentOSConfig {
  vaultPath: string;
  projectsRoot: string;
  claudeHome: string;
  serverPort: number;
}

export const repoRoot = path.resolve(import.meta.dirname, "..", "..");

const DEFAULTS: AgentOSConfig = {
  vaultPath: "vault",
  projectsRoot: "D:\\projs",
  claudeHome: path.join(os.homedir(), ".claude"),
  serverPort: 4310,
};

function resolveFromRepo(p: string): string {
  if (p.startsWith("~")) p = path.join(os.homedir(), p.slice(1));
  return path.isAbsolute(p) ? p : path.resolve(repoRoot, p);
}

let cached: AgentOSConfig | null = null;

export function getConfig(): AgentOSConfig {
  if (cached) return cached;
  let raw: Partial<AgentOSConfig> = {};
  const file = path.join(repoRoot, "agentos.config.json");
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // missing/invalid config file — fall back to defaults
  }
  const merged = { ...DEFAULTS, ...raw };
  cached = {
    ...merged,
    vaultPath: resolveFromRepo(merged.vaultPath),
    projectsRoot: resolveFromRepo(merged.projectsRoot),
    claudeHome: resolveFromRepo(merged.claudeHome),
  };
  return cached;
}
