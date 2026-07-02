import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "../config.js";
import type { Usage } from "../metrics/pricing.js";

export interface RunRecord {
  id: string;
  skillId: string;
  skillName: string;
  params: Record<string, string>;
  status: "running" | "success" | "error" | "cancelled";
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  costUSD?: number;
  usage?: Usage;
  numTurns?: number;
  toolCalls: number;
  sessionId?: string;
  resultText?: string;
  error?: string;
}

const runsFile = path.join(repoRoot, "data", "runs.jsonl");
const runs = new Map<string, RunRecord>();
let loaded = false;

/** Append-only log; on load, the last record per id wins (crash-safe updates). */
function loadOnce(): void {
  if (loaded) return;
  loaded = true;
  try {
    const lines = fs.readFileSync(runsFile, "utf8").split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const rec: RunRecord = JSON.parse(line);
        // a run that was "running" when the server died is effectively dead
        if (rec.status === "running") rec.status = "error";
        runs.set(rec.id, rec);
      } catch {
        // skip corrupt line
      }
    }
  } catch {
    // no runs file yet
  }
}

export function saveRun(rec: RunRecord): void {
  loadOnce();
  runs.set(rec.id, { ...rec });
  fs.mkdirSync(path.dirname(runsFile), { recursive: true });
  fs.appendFileSync(runsFile, JSON.stringify(rec) + "\n", "utf8");
}

export function listRuns(): RunRecord[] {
  loadOnce();
  return [...runs.values()].sort((a, b) => b.startedAt - a.startedAt);
}

export function getRun(id: string): RunRecord | undefined {
  loadOnce();
  return runs.get(id);
}
