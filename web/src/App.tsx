import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import CommandPalette, { type Command } from "./components/CommandPalette";
import DeckView from "./views/DeckView";
import MissionControl from "./views/MissionControl";
import SkillsView from "./views/SkillsView";
import AnalyticsView from "./views/AnalyticsView";
import VaultView from "./views/VaultView";
import { useLive } from "./lib/ws";
import { api, fmtUSD } from "./lib/api";
import { springSnappy, viewTransition } from "./lib/motion";

type ViewId = "deck" | "mission" | "skills" | "analytics" | "vault";

const NAV: Array<{ id: ViewId; label: string; icon: string }> = [
  { id: "deck", label: "Overview", icon: "🚀" },
  { id: "mission", label: "Mission Control", icon: "🛰️" },
  { id: "skills", label: "Skills", icon: "⚡" },
  { id: "analytics", label: "Analytics", icon: "📊" },
  { id: "vault", label: "Vault", icon: "🗄️" },
];

export default function App() {
  const [view, setView] = useState<ViewId>("deck");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [todayCost, setTodayCost] = useState<number | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openRun = useCallback((runId: string) => {
    setSelectedRunId(runId);
    setView("mission");
  }, []);

  const openNote = useCallback((path: string) => {
    setVaultPath(path);
    setView("vault");
  }, []);

  const navCommands = useMemo<Command[]>(
    () =>
      NAV.map((n) => ({
        id: `nav-${n.id}`,
        label: `Go to ${n.label}`,
        icon: n.icon,
        hint: "view",
        action: () => setView(n.id),
      })),
    [],
  );

  return (
    <div className="h-full flex">
      {/* sidebar */}
      <aside className="w-56 shrink-0 border-r border-edge bg-panel/70 backdrop-blur flex flex-col">
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
              className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                view === n.id ? "text-ink" : "text-dim hover:text-ink"
              }`}
            >
              {view === n.id && (
                <motion.span
                  layoutId="nav-pill"
                  transition={springSnappy}
                  className="absolute inset-0 rounded-lg bg-panel2 border border-edge"
                />
              )}
              <span className="relative text-base">{n.icon}</span>
              <span className="relative">{n.label}</span>
              {n.id === "mission" && activeRuns > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={springSnappy}
                  className="relative ml-auto text-[10px] font-mono bg-accent/15 text-accent px-1.5 py-0.5 rounded-full"
                >
                  {activeRuns}
                </motion.span>
              )}
              {n.id === "mission" && approvals.length > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={springSnappy}
                  className="relative ml-1 text-[10px] font-mono bg-warn/20 text-warn px-1.5 py-0.5 rounded-full"
                >
                  !
                </motion.span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-edge text-[11px] font-mono space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="relative w-2 h-2">
              <span
                className={`absolute inset-0 rounded-full ${connected ? "bg-ok" : "bg-bad animate-pulse"}`}
              />
            </span>
            <span className="text-dim">{connected ? "server linked" : "reconnecting…"}</span>
          </div>
          <div className="text-dim">
            today <span className="text-ink">{todayCost == null ? "…" : fmtUSD(todayCost)}</span>{" "}
            est.
          </div>
          <button
            onClick={() => setPaletteOpen(true)}
            className="text-dim hover:text-ink transition-colors"
          >
            <kbd className="px-1 py-0.5 bg-panel2 border border-edge rounded text-[10px]">ctrl</kbd>{" "}
            <kbd className="px-1 py-0.5 bg-panel2 border border-edge rounded text-[10px]">k</kbd>{" "}
            palette
          </button>
        </div>
      </aside>

      {/* main */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div key={view} className="h-full" {...viewTransition}>
            {view === "deck" && (
              <DeckView
                onRunStarted={openRun}
                onOpenSkills={() => setView("skills")}
                onOpenNote={openNote}
                onOpenRun={openRun}
              />
            )}
            {view === "mission" && (
              <MissionControl selectedRunId={selectedRunId} onSelectRun={setSelectedRunId} />
            )}
            {view === "skills" && <SkillsView onRunStarted={openRun} />}
            {view === "analytics" && <AnalyticsView />}
            {view === "vault" && <VaultView initialPath={vaultPath} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navCommands={navCommands}
        onRunStarted={openRun}
        onOpenSkills={() => setView("skills")}
      />
    </div>
  );
}
