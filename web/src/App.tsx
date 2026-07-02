import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import CommandPalette, { type Command } from "./components/CommandPalette";
import DeckView from "./views/DeckView";
import MissionControl from "./views/MissionControl";
import SkillsView from "./views/SkillsView";
import AnalyticsView from "./views/AnalyticsView";
import VaultView from "./views/VaultView";
import { useLive } from "./lib/ws";
import { api, fmtUSD } from "./lib/api";
import { springSnappy, viewTransition } from "./lib/motion";

const NAV: Array<{ to: string; label: string; icon: string }> = [
  { to: "/", label: "Overview", icon: "🚀" },
  { to: "/mission", label: "Mission Control", icon: "🛰️" },
  { to: "/skills", label: "Skills", icon: "⚡" },
  { to: "/analytics", label: "Analytics", icon: "📊" },
  { to: "/vault", label: "Vault", icon: "🗄️" },
];

export default function App() {
  const [todayCost, setTodayCost] = useState<number | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { connected, runEvents, approvals, autoApprove, setAutoApprove } = useLive();
  const navigate = useNavigate();
  const location = useLocation();
  const section = "/" + (location.pathname.split("/")[1] ?? "");

  const activeRuns = useMemo(
    () => Object.values(runEvents).filter((r) => r.status === "running").length,
    [runEvents],
  );

  useEffect(() => {
    api
      .metrics(1, true)
      .then((m) => setTodayCost(m.summary.totalCostUSD))
      .catch(() => {});
  }, [section]);

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

  const navCommands = useMemo<Command[]>(
    () =>
      NAV.map((n) => ({
        id: `nav-${n.to}`,
        label: `Go to ${n.label}`,
        icon: n.icon,
        hint: "view",
        action: () => navigate(n.to),
      })),
    [navigate],
  );

  return (
    <div className="h-full flex">
      {/* sidebar */}
      <aside className="w-60 shrink-0 border-r border-edge bg-panel/70 backdrop-blur flex flex-col">
        <div className="px-5 py-5 border-b border-edge">
          <div className="text-2xl tracking-tight h-display">
            Agent<span className="text-accent">OS</span>
          </div>
          <div className="text-[11px] text-dim mt-0.5 font-mono">claude code, clickable</div>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          {NAV.map((n) => {
            const active = section === n.to || (n.to === "/mission" && section === "/mission");
            return (
              <NavLink
                key={n.to}
                to={n.to}
                className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? "text-ink" : "text-dim hover:text-ink"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={springSnappy}
                    className="absolute inset-0 rounded-lg bg-panel2 border border-edge"
                  />
                )}
                <span className="relative text-base">{n.icon}</span>
                <span className="relative">{n.label}</span>
                {n.to === "/mission" && activeRuns > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={springSnappy}
                    className="relative ml-auto text-[10px] font-mono bg-accent/15 text-accent px-1.5 py-0.5 rounded-full"
                  >
                    {activeRuns}
                  </motion.span>
                )}
                {n.to === "/mission" && approvals.length > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={springSnappy}
                    className="relative ml-1 text-[10px] font-mono bg-warn/20 text-warn px-1.5 py-0.5 rounded-full"
                  >
                    !
                  </motion.span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-4 border-t border-edge text-[11px] font-mono space-y-2">
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
            onClick={() => setAutoApprove(!autoApprove)}
            title="When on, agents never wait for permission — every tool call is approved automatically."
            className="flex items-center gap-2 text-dim hover:text-ink transition-colors"
          >
            <span
              className={`w-7 h-4 rounded-full relative transition-colors ${
                autoApprove ? "bg-warn/70" : "bg-panel2 border border-edge"
              }`}
            >
              <motion.span
                layout
                transition={springSnappy}
                className={`absolute top-0.5 w-3 h-3 rounded-full ${
                  autoApprove ? "right-0.5 bg-bg" : "left-0.5 bg-dim"
                }`}
              />
            </span>
            <span className={autoApprove ? "text-warn" : ""}>
              auto-approve {autoApprove ? "on" : "off"}
            </span>
          </button>
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
          <motion.div key={section} className="h-full" {...viewTransition}>
            <Routes location={location}>
              <Route path="/" element={<DeckView />} />
              <Route path="/mission/:runId?" element={<MissionControl />} />
              <Route path="/skills" element={<SkillsView />} />
              <Route path="/analytics" element={<AnalyticsView />} />
              <Route path="/vault" element={<VaultView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navCommands={navCommands}
        onRunStarted={(id) => navigate(`/mission/${id}`)}
        onOpenSkills={() => navigate("/skills")}
      />
    </div>
  );
}
