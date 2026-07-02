import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtAgo, fmtTokens, fmtUSD } from "../lib/api";
import { CountUp, rise, stagger } from "../lib/motion";
import type { PulseResponse, RunRecord, SkillMeta } from "../lib/types";
import { useLive } from "../lib/ws";

const STATUS_COLOR: Record<RunRecord["status"], string> = {
  running: "text-accent",
  success: "text-ok",
  error: "text-bad",
  cancelled: "text-warn",
};

/** Animated ring: how much of the last 7 days' usage happened in the last 5 hours. */
function BurnRing({ frac }: { frac: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const clamped = Math.min(1, Math.max(0, frac));
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0">
      <circle cx="64" cy="64" r={R} fill="none" stroke="var(--color-panel2)" strokeWidth="10" />
      <motion.circle
        cx="64"
        cy="64"
        r={R}
        fill="none"
        stroke={clamped > 0.5 ? "var(--color-warn)" : "var(--color-accent)"}
        strokeWidth="10"
        strokeLinecap="round"
        transform="rotate(-90 64 64)"
        strokeDasharray={C}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: C * (1 - clamped) }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
      <text
        x="64"
        y="60"
        textAnchor="middle"
        className="fill-ink font-mono"
        style={{ fontSize: 22, fontWeight: 600 }}
      >
        {Math.round(clamped * 100)}%
      </text>
      <text x="64" y="78" textAnchor="middle" className="fill-dim" style={{ fontSize: 9 }}>
        of week, last 5h
      </text>
    </svg>
  );
}

export default function DeckView() {
  const navigate = useNavigate();
  const onRunStarted = (runId: string) => navigate(`/mission/${runId}`);
  const onOpenSkills = () => navigate("/skills");
  const onOpenNote = (path: string) => navigate(`/vault?note=${encodeURIComponent(path)}`);
  const onOpenRun = (runId: string) => navigate(`/mission/${runId}`);
  const [pulse, setPulse] = useState<PulseResponse | null>(null);
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [launching, setLaunching] = useState<string | null>(null);
  const { runEvents } = useLive();

  useEffect(() => {
    api.pulse().then(setPulse).catch(console.error);
    api.skills().then(setSkills).catch(console.error);
  }, [runEvents]);

  const quickRun = useCallback(
    async (s: SkillMeta) => {
      if (s.params.some((p) => p.required && !p.default)) {
        onOpenSkills();
        return;
      }
      setLaunching(s.id);
      try {
        onRunStarted(await api.runSkill(s.id, {}));
      } catch (e) {
        console.error(e);
      } finally {
        setLaunching(null);
      }
    },
    [onRunStarted, onOpenSkills],
  );

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Night shift" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const burnFrac =
    pulse && pulse.window7d.costUSD > 0 ? pulse.window5h.costUSD / pulse.window7d.costUSD : 0;

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-3xl h-display">{greeting}, Sirjan</h1>
      <p className="text-sm text-dim mt-1 font-mono">
        {pulse?.activeRuns ? `${pulse.activeRuns} agent${pulse.activeRuns > 1 ? "s" : ""} working right now` : "all agents idle"}
      </p>

      <motion.div variants={stagger} initial="hidden" animate="show" className="mt-6 space-y-5">
        {/* burn + today */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <motion.div variants={rise} className="panel panel-glow p-5 flex items-center gap-5 md:col-span-1">
            <BurnRing frac={burnFrac} />
            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="text-dim uppercase tracking-wider">Burn window</div>
              <div>
                5h <span className="text-ink text-sm">{pulse ? fmtUSD(pulse.window5h.costUSD) : "…"}</span>
              </div>
              <div>
                7d <span className="text-ink text-sm">{pulse ? fmtUSD(pulse.window7d.costUSD) : "…"}</span>
              </div>
              <div className="text-dim">est. from ~/.claude</div>
            </div>
          </motion.div>
          <motion.div variants={rise} className="panel panel-glow p-5">
            <div className="text-[11px] uppercase tracking-wider text-dim">Today</div>
            <div className="text-2xl font-semibold mt-1 font-mono">
              {pulse ? <CountUp value={pulse.today.totalCostUSD} format={fmtUSD} /> : "…"}
            </div>
            <div className="text-[11px] text-dim mt-0.5 font-mono">
              {pulse ? `${pulse.today.totalSessions} sessions · ${pulse.today.totalPrompts} prompts` : ""}
            </div>
          </motion.div>
          <motion.div variants={rise} className="panel panel-glow p-5">
            <div className="text-[11px] uppercase tracking-wider text-dim">Output, last 5h</div>
            <div className="text-2xl font-semibold mt-1 font-mono">
              {pulse ? <CountUp value={pulse.window5h.output} format={fmtTokens} /> : "…"}
            </div>
            <div className="text-[11px] text-dim mt-0.5 font-mono">
              tokens across {pulse?.window5h.sessions ?? 0} sessions
            </div>
          </motion.div>
        </div>

        {/* quick launch */}
        <motion.div variants={rise} className="panel p-5">
          <div className="flex items-baseline gap-3">
            <h3 className="text-sm font-semibold">Quick launch</h3>
            <button onClick={onOpenSkills} className="ml-auto text-[11px] font-mono text-dim hover:text-accent">
              all skills →
            </button>
          </div>
          <div className="flex flex-wrap gap-2.5 mt-3">
            {skills.map((s) => (
              <motion.button
                key={s.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => quickRun(s)}
                disabled={launching === s.id}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-panel2/70 border border-edge hover:border-accent/40 text-sm disabled:opacity-50 transition-colors"
              >
                <span>{s.icon}</span>
                {launching === s.id ? "launching…" : s.name}
                {s.params.some((p) => p.required && !p.default) && (
                  <span className="text-[10px] font-mono text-dim">needs input</span>
                )}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* recent runs + vault activity */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <motion.div variants={rise} className="panel p-5">
            <h3 className="text-sm font-semibold mb-3">Recent runs</h3>
            <div className="space-y-1">
              {(pulse?.recentRuns ?? []).map((r) => (
                <button
                  key={r.id}
                  onClick={() => onOpenRun(r.id)}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-panel2/60 text-left transition-colors"
                >
                  <span className={`text-xs font-mono ${STATUS_COLOR[r.status]}`}>●</span>
                  <span className="text-sm truncate">{r.skillName}</span>
                  <span className="ml-auto text-[11px] font-mono text-dim shrink-0">
                    {r.costUSD != null && `${fmtUSD(r.costUSD)} · `}
                    {fmtAgo(r.startedAt)}
                  </span>
                </button>
              ))}
              {pulse && pulse.recentRuns.length === 0 && (
                <div className="text-sm text-dim px-2 py-3">No runs yet — hit Quick launch.</div>
              )}
            </div>
          </motion.div>
          <motion.div variants={rise} className="panel p-5">
            <h3 className="text-sm font-semibold mb-3">Vault activity</h3>
            <div className="space-y-1">
              {(pulse?.recentNotes ?? []).map((n) => (
                <button
                  key={n.path}
                  onClick={() => onOpenNote(n.path)}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-panel2/60 text-left transition-colors"
                >
                  <span className="text-xs">📝</span>
                  <span className="text-sm truncate">{n.name}</span>
                  <span className="ml-auto text-[11px] font-mono text-dim shrink-0">{fmtAgo(n.mtimeMs)}</span>
                </button>
              ))}
              {pulse && pulse.recentNotes.length === 0 && (
                <div className="text-sm text-dim px-2 py-3">Vault is empty — run a skill.</div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
