import { useEffect, useMemo, useState } from "react";
import { api, fmtDuration, fmtUSD } from "../lib/api";
import type { RunRecord, SkillMeta } from "../lib/types";
import { useLive } from "../lib/ws";

interface SkillStats {
  runs: number;
  successRate: number | null;
  avgDurationMs: number | null;
  avgCostUSD: number | null;
  recent: RunRecord[];
}

function computeStats(runs: RunRecord[]): SkillStats {
  const finished = runs.filter((r) => r.status !== "running");
  const ok = finished.filter((r) => r.status === "success");
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    runs: runs.length,
    successRate: finished.length ? ok.length / finished.length : null,
    avgDurationMs: avg(finished.map((r) => r.durationMs ?? 0).filter(Boolean)),
    avgCostUSD: avg(finished.map((r) => r.costUSD ?? 0).filter(Boolean)),
    recent: runs.slice(0, 12),
  };
}

function Sparkline({ runs }: { runs: RunRecord[] }) {
  if (!runs.length) return null;
  const pts = [...runs].reverse();
  const max = Math.max(...pts.map((r) => r.durationMs ?? 0), 1);
  return (
    <div className="flex items-end gap-[3px] h-6" title="recent run durations">
      {pts.map((r) => (
        <div
          key={r.id}
          style={{ height: `${Math.max(15, ((r.durationMs ?? 0) / max) * 100)}%` }}
          className={`w-1.5 rounded-sm ${
            r.status === "success"
              ? "bg-ok/70"
              : r.status === "running"
                ? "bg-accent/70 animate-pulse"
                : "bg-bad/70"
          }`}
        />
      ))}
    </div>
  );
}

function SkillCard({
  skill,
  stats,
  onRunStarted,
}: {
  skill: SkillMeta;
  stats: SkillStats;
  onRunStarted: (runId: string) => void;
}) {
  const [params, setParams] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const launch = async () => {
    setBusy(true);
    setError(null);
    try {
      const runId = await api.runSkill(skill.id, params);
      onRunStarted(runId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel p-5 flex flex-col gap-4 hover:border-accent/40 transition-colors">
      <div className="flex items-start gap-3">
        <div className="text-3xl leading-none">{skill.icon}</div>
        <div className="min-w-0">
          <div className="font-semibold">{skill.name}</div>
          <div className="text-sm text-dim mt-0.5 leading-snug">{skill.description}</div>
        </div>
      </div>

      {skill.params.length > 0 && (
        <div className="space-y-2">
          {skill.params.map((p) => (
            <label key={p.name} className="block">
              <span className="text-[11px] uppercase tracking-wide text-dim">{p.label}</span>
              {p.type === "select" ? (
                <select
                  className="mt-1 w-full bg-panel2 border border-edge rounded-lg px-2.5 py-1.5 text-sm"
                  value={params[p.name] ?? p.default ?? ""}
                  onChange={(e) => setParams({ ...params, [p.name]: e.target.value })}
                >
                  {(p.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="mt-1 w-full bg-panel2 border border-edge rounded-lg px-2.5 py-1.5 text-sm placeholder:text-dim/60"
                  placeholder={p.placeholder}
                  value={params[p.name] ?? ""}
                  onChange={(e) => setParams({ ...params, [p.name]: e.target.value })}
                />
              )}
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 text-[11px] font-mono text-dim">
        <span>
          runs <span className="text-ink">{stats.runs}</span>
        </span>
        <span>
          ok{" "}
          <span className="text-ink">
            {stats.successRate == null ? "—" : `${Math.round(stats.successRate * 100)}%`}
          </span>
        </span>
        <span>
          avg <span className="text-ink">{fmtDuration(stats.avgDurationMs ?? undefined)}</span>
        </span>
        <span>
          cost <span className="text-ink">{fmtUSD(stats.avgCostUSD ?? undefined)}</span>
        </span>
        <div className="ml-auto">
          <Sparkline runs={stats.recent} />
        </div>
      </div>

      {error && <div className="text-xs text-bad">{error}</div>}

      <button
        onClick={launch}
        disabled={busy}
        className="w-full py-2 rounded-lg bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 disabled:opacity-50 text-sm font-medium transition-colors"
      >
        {busy ? "Launching…" : "▶ Run"}
      </button>
    </div>
  );
}

export default function SkillsView({ onRunStarted }: { onRunStarted: (runId: string) => void }) {
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const { runEvents } = useLive();

  useEffect(() => {
    api.skills().then(setSkills).catch(console.error);
    api.runs().then((r) => setRuns(r.runs)).catch(console.error);
  }, [runEvents]); // refresh stats whenever a run starts/finishes

  const statsBySkill = useMemo(() => {
    const merged = new Map(runs.map((r) => [r.id, r]));
    for (const r of Object.values(runEvents)) merged.set(r.id, r);
    const all = [...merged.values()].sort((a, b) => b.startedAt - a.startedAt);
    const map = new Map<string, RunRecord[]>();
    for (const r of all) {
      map.set(r.skillId, [...(map.get(r.skillId) ?? []), r]);
    }
    return map;
  }, [runs, runEvents]);

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-xl font-semibold">Skills Launchpad</h1>
      <p className="text-sm text-dim mt-1">
        Your daily work as one-click agents. Drop a <code className="font-mono">*.skill.md</code>{" "}
        file into <code className="font-mono">skills/</code> to add one.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-6">
        {skills.map((s) => (
          <SkillCard
            key={s.id}
            skill={s}
            stats={computeStats(statsBySkill.get(s.id) ?? [])}
            onRunStarted={onRunStarted}
          />
        ))}
        {skills.length === 0 && (
          <div className="panel p-8 text-dim text-sm col-span-full text-center">
            No skills found — is the server running?
          </div>
        )}
      </div>
    </div>
  );
}
