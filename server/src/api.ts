import express, { type Request, type Response, type Router } from "express";
import {
  activeRunIds,
  getAutoApprove,
  setAutoApprove,
  startRun,
  stopRun,
  type Broadcast,
} from "./agent/runner.js";
import {
  activityHeatmap,
  dailySeries,
  filterSessions,
  modelBreakdown,
  projectRows,
  summarize,
  toolBreakdown,
  windowUsage,
} from "./metrics/aggregate.js";
import { scanSessions } from "./metrics/store.js";
import { getSkill, loadSkills } from "./skills/loader.js";
import { listRuns } from "./skills/runstore.js";
import { readNote, recentNotes, vaultTree } from "./obsidian/vault.js";

export function createApi(broadcast: Broadcast): Router {
  const api = express.Router();
  api.use(express.json());

  // ---- skills ----
  api.get("/skills", (_req, res) => {
    // strip the prompt body from the listing — the UI only needs metadata
    res.json(loadSkills().map(({ promptTemplate, ...meta }) => meta));
  });

  api.post("/skills/:id/run", (req: Request, res: Response) => {
    const skill = getSkill(String(req.params.id));
    if (!skill) return res.status(404).json({ error: "unknown skill" });
    const params: Record<string, string> = req.body?.params ?? {};
    for (const p of skill.params) {
      if (p.required && !params[p.name] && !p.default) {
        return res.status(400).json({ error: `missing required param: ${p.name}` });
      }
    }
    const record = startRun(skill, params, broadcast);
    res.json({ runId: record.id });
  });

  // ---- runs ----
  api.get("/runs", (_req, res) => {
    res.json({ runs: listRuns().slice(0, 200), active: activeRunIds() });
  });

  api.post("/runs/:id/stop", async (req, res) => {
    const ok = await stopRun(String(req.params.id));
    res.status(ok ? 200 : 404).json({ stopped: ok });
  });

  // ---- metrics ----
  api.get("/metrics", async (req, res) => {
    const days = Math.max(1, Math.min(365, Number(req.query.days) || 30));
    const includeAgentOS = req.query.includeAgentOS === "true";
    try {
      const all = await scanSessions();
      const sessions = filterSessions(all, { days, includeAgentOS });
      res.json({
        days,
        includeAgentOS,
        summary: summarize(sessions),
        daily: dailySeries(sessions, days),
        projects: projectRows(sessions),
        tools: toolBreakdown(sessions),
        heatmap: activityHeatmap(sessions),
        models: modelBreakdown(sessions),
        costIsEstimate: true,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ---- pulse: one call powering the Overview view ----
  api.get("/pulse", async (_req, res) => {
    try {
      const all = await scanSessions();
      const everything = filterSessions(all, { includeAgentOS: true });
      const runs = listRuns();
      res.json({
        window5h: windowUsage(everything, 5 * 3_600_000),
        window7d: windowUsage(everything, 7 * 86_400_000),
        today: summarize(filterSessions(all, { days: 1, includeAgentOS: true })),
        recentNotes: recentNotes(8),
        recentRuns: runs.slice(0, 6),
        activeRuns: activeRunIds().length,
        costIsEstimate: true,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ---- settings ----
  api.get("/settings", (_req, res) => {
    res.json({ autoApprove: getAutoApprove() });
  });

  api.post("/settings", (req, res) => {
    if (typeof req.body?.autoApprove === "boolean") {
      setAutoApprove(req.body.autoApprove);
      broadcast({ type: "settings", settings: { autoApprove: getAutoApprove() } });
    }
    res.json({ autoApprove: getAutoApprove() });
  });

  // ---- vault ----
  api.get("/vault/tree", (_req, res) => {
    res.json({ tree: vaultTree() });
  });

  api.get("/vault/note", (req, res) => {
    const rel = String(req.query.path ?? "");
    try {
      res.json(readNote(rel));
    } catch {
      res.status(404).json({ error: "note not found" });
    }
  });

  return api;
}
