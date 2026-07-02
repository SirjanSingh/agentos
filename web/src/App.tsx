import { useCallback, useEffect, useMemo, useState } from "react";
import MissionControl from "./views/MissionControl";
import SkillsView from "./views/SkillsView";
import AnalyticsView from "./views/AnalyticsView";
import VaultView from "./views/VaultView";
import { useLive } from "./lib/ws";
import { api, fmtUSD } from "./lib/api";

type ViewId = "mission" | "skills" | "analytics" | "vault";

const NAV: Array<{ id: ViewId; label: string; icon: string }> = [
  { id: "mission", label: "Mission Control", icon: "🛰️" },
  { id: "skills", label: "Skills", icon: "⚡" },
  { id: "analytics", label: "Analytics", icon: "📊" },
  { id: "vault", label: "Vault", icon: "🗄️" },
];

export default function App() {
  const [view, setView] = useState<ViewId>("skills");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [todayCost, setTodayCost] = useState<number | null>(null);
  const { connected, runEvents, approvals } = useLive();

  const activeRuns = useMemo(
    () => Object.values(runEvents).filter((r) => r.status === "running").length,
    [runEvents],
  );

  useEffect(() => {
    api
      .metrics(1, true)
      .then((m) => setTodayCost(m.summary.totalCostUSD))
      .catch(() => {});
  }, [view]);

  const openRun = useCallback((runId: string) => {
    setSelectedRunId(runId);
    setView("mission");
  }, []);

  return (
    <div className="h-full flex">
      {/* sidebar */}
      <aside className="w-56 shrink-0 border-r border-edge bg-panel flex flex-col">
        <div className="px-5 py-5 border-b border-edge">
          <div className="text-lg font-semibold tracking-tight">
            Agent<span className="text-accent">OS</span>
          </div>
          <div className="text-[11px] text-dim mt-0.5 font-mono">claude code, clickable</div>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                view === n.id
                  ? "bg-panel2 text-ink border border-edge"
                  : "text-dim hover:text-ink hover:bg-panel2/50 border border-transparent"
              }`}
            >
              <span className="text-base">{n.icon}</span>
              {n.label}
              {n.id === "mission" && activeRuns > 0 && (
                <span className="ml-auto text-[10px] font-mono bg-accent/15 text-accent px-1.5 py-0.5 rounded-full">
                  {activeRuns}
                </span>
              )}
              {n.id === "mission" && approvals.length > 0 && (
                <span className="ml-1 text-[10px] font-mono bg-warn/20 text-warn px-1.5 py-0.5 rounded-full">
                  !
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-edge text-[11px] font-mono space-y-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${connected ? "bg-ok" : "bg-bad animate-pulse"}`}
            />
            <span className="text-dim">{connected ? "server linked" : "reconnecting…"}</span>
          </div>
          <div className="text-dim">
            today <span className="text-ink">{todayCost == null ? "…" : fmtUSD(todayCost)}</span>{" "}
            est.
          </div>
        </div>
      </aside>

      {/* main */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {view === "mission" && (
          <MissionControl selectedRunId={selectedRunId} onSelectRun={setSelectedRunId} />
        )}
        {view === "skills" && <SkillsView onRunStarted={openRun} />}
        {view === "analytics" && <AnalyticsView />}
        {view === "vault" && <VaultView />}
      </main>
    </div>
  );
}
