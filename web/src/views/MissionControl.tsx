import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, fmtAgo, fmtDuration, fmtUSD } from "../lib/api";
import type { AgentMessage, RunRecord } from "../lib/types";
import { useLive } from "../lib/ws";

const STATUS_STYLE: Record<RunRecord["status"], string> = {
  running: "text-accent",
  success: "text-ok",
  error: "text-bad",
  cancelled: "text-warn",
};

const STATUS_DOT: Record<RunRecord["status"], string> = {
  running: "bg-accent relative dot-live",
  success: "bg-ok",
  error: "bg-bad",
  cancelled: "bg-warn",
};

function ToolCallCard({ block }: { block: any }) {
  const [open, setOpen] = useState(false);
  const summary = useMemo(() => {
    const input = block.input ?? {};
    const firstString = Object.values(input).find((v) => typeof v === "string") as
      | string
      | undefined;
    return firstString?.slice(0, 120) ?? "";
  }, [block]);
  return (
    <div className="border border-edge bg-panel2/60 rounded-lg my-1.5 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-panel2"
      >
        <span className="text-accent2 font-mono text-xs">🔧 {block.name}</span>
        <span className="text-dim text-xs font-mono truncate flex-1">{summary}</span>
        <span className="text-dim text-xs">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <pre className="px-3 py-2 text-[11px] font-mono text-dim overflow-x-auto border-t border-edge max-h-64 overflow-y-auto">
          {JSON.stringify(block.input, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ToolResultCard({ block }: { block: any }) {
  const [open, setOpen] = useState(false);
  const text = useMemo(() => {
    if (typeof block.content === "string") return block.content;
    if (Array.isArray(block.content)) {
      return block.content
        .filter((c: any) => c?.type === "text")
        .map((c: any) => c.text)
        .join("\n");
    }
    return "";
  }, [block]);
  if (!text) return null;
  return (
    <div className="my-1">
      <button onClick={() => setOpen(!open)} className="text-[11px] font-mono text-dim hover:text-ink">
        {open ? "▾" : "▸"} result ({text.length.toLocaleString()} chars)
        {block.is_error ? <span className="text-bad"> · error</span> : null}
      </button>
      {open && (
        <pre className="mt-1 px-3 py-2 text-[11px] font-mono text-dim bg-panel2/60 border border-edge rounded-lg overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
          {text.slice(0, 5000)}
          {text.length > 5000 ? "\n… (truncated)" : ""}
        </pre>
      )}
    </div>
  );
}

function TranscriptMessage({ msg }: { msg: AgentMessage }) {
  if (msg.type === "system" && msg.subtype === "init") {
    return (
      <div className="text-[11px] font-mono text-dim py-1">
        ⚙ session {String(msg.session_id ?? "").slice(0, 8)} · model {msg.model} ·{" "}
        {Array.isArray(msg.tools) ? msg.tools.length : 0} tools
      </div>
    );
  }
  if (msg.type === "assistant" && Array.isArray(msg.message?.content)) {
    return (
      <>
        {msg.message.content.map((block: any, i: number) => {
          if (block.type === "text" && block.text?.trim()) {
            return (
              <div key={i} className="md-body text-sm py-1">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.text}</ReactMarkdown>
              </div>
            );
          }
          if (block.type === "tool_use") return <ToolCallCard key={i} block={block} />;
          return null;
        })}
      </>
    );
  }
  if (msg.type === "user" && Array.isArray(msg.message?.content)) {
    return (
      <>
        {msg.message.content.map((block: any, i: number) =>
          block.type === "tool_result" ? <ToolResultCard key={i} block={block} /> : null,
        )}
      </>
    );
  }
  if (msg.type === "result") {
    return (
      <div
        className={`mt-2 border rounded-lg px-3 py-2 text-xs font-mono ${
          msg.subtype === "success" ? "border-ok/30 bg-ok/5 text-ok" : "border-bad/30 bg-bad/5 text-bad"
        }`}
      >
        {msg.subtype === "success" ? "✓ finished" : `✗ ${msg.subtype}`} ·{" "}
        {fmtDuration(msg.duration_ms)} · {msg.num_turns} turns · {fmtUSD(msg.total_cost_usd)}
      </div>
    );
  }
  return null;
}

export default function MissionControl({
  selectedRunId,
  onSelectRun,
}: {
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
}) {
  const { transcripts, liveText, runEvents, approvals, respondApproval } = useLive();
  const [restRuns, setRestRuns] = useState<RunRecord[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.runs().then((r) => setRestRuns(r.runs)).catch(console.error);
  }, [runEvents]);

  const runs = useMemo(() => {
    const merged = new Map(restRuns.map((r) => [r.id, r]));
    for (const r of Object.values(runEvents)) merged.set(r.id, r);
    return [...merged.values()].sort((a, b) => b.startedAt - a.startedAt);
  }, [restRuns, runEvents]);

  const selected = runs.find((r) => r.id === selectedRunId) ?? runs[0];
  const transcript = selected ? (transcripts[selected.id] ?? []) : [];
  const live = selected ? (liveText[selected.id] ?? "") : "";
  const runApprovals = approvals.filter((a) => a.runId === selected?.id);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [transcript.length, live, runApprovals.length]);

  return (
    <div className="h-full flex">
      {/* run list */}
      <div className="w-72 shrink-0 border-r border-edge p-4 space-y-2 overflow-y-auto">
        <h2 className="text-sm font-semibold text-dim uppercase tracking-wider px-1">Runs</h2>
        {runs.length === 0 && (
          <div className="text-sm text-dim px-1 py-4">
            Nothing yet — launch a skill from the Launchpad.
          </div>
        )}
        {runs.slice(0, 50).map((r) => (
          <motion.button
            key={r.id}
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={() => onSelectRun(r.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
              selected?.id === r.id
                ? "bg-panel2 border-edge"
                : "border-transparent hover:bg-panel2/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[r.status]}`} />
              <span className="text-sm truncate">{r.skillName}</span>
              {approvals.some((a) => a.runId === r.id) && (
                <span className="ml-auto text-[10px] text-warn font-mono shrink-0">needs you</span>
              )}
            </div>
            <div className="text-[11px] font-mono text-dim mt-1 flex gap-2">
              <span className={STATUS_STYLE[r.status]}>{r.status}</span>
              <span>{fmtAgo(r.startedAt)}</span>
              {r.costUSD != null && <span>{fmtUSD(r.costUSD)}</span>}
            </div>
          </motion.button>
        ))}
      </div>

      {/* transcript */}
      <div className="flex-1 min-w-0 flex flex-col">
        {selected ? (
          <>
            <div className="px-6 py-4 border-b border-edge flex items-center gap-4">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${STATUS_DOT[selected.status]}`} />
                  {selected.skillName}
                  <span className="text-[11px] font-mono text-dim">#{selected.id}</span>
                </div>
                <div className="text-[11px] font-mono text-dim mt-0.5">
                  {Object.entries(selected.params)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(" · ") || "no params"}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-4 text-[11px] font-mono text-dim">
                <span>
                  {selected.toolCalls} tool calls
                  {selected.durationMs != null && <> · {fmtDuration(selected.durationMs)}</>}
                  {selected.costUSD != null && <> · {fmtUSD(selected.costUSD)}</>}
                </span>
                {selected.status === "running" && (
                  <button
                    onClick={() => api.stopRun(selected.id)}
                    className="px-3 py-1.5 rounded-lg border border-bad/40 text-bad hover:bg-bad/10"
                  >
                    ■ Stop
                  </button>
                )}
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
              {transcript.length === 0 && selected.status === "running" && !live && (
                <div className="text-sm text-dim animate-pulse">agent starting…</div>
              )}
              {transcript.length === 0 && selected.status !== "running" && (
                <div className="text-sm text-dim">
                  Transcript not available (run predates this browser session).
                  {selected.resultText && (
                    <div className="md-body mt-3 text-ink">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {selected.resultText}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
              {transcript.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <TranscriptMessage msg={m} />
                </motion.div>
              ))}
              {live && (
                <div className="md-body text-sm py-1 opacity-80">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{live}</ReactMarkdown>
                  <span className="caret inline-block w-2 h-4 bg-accent ml-0.5 align-text-bottom" />
                </div>
              )}
            </div>

            {/* approval bar */}
            <AnimatePresence>
            {runApprovals.map((a) => (
              <motion.div
                key={a.requestId}
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
                className="mx-6 mb-4 border border-warn/40 bg-warn/10 rounded-xl px-4 py-3 flex items-center gap-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-warn">
                    Permission: <span className="font-mono">{a.toolName}</span>
                  </div>
                  <div className="text-[11px] font-mono text-dim truncate mt-0.5">
                    {JSON.stringify(a.input).slice(0, 160)}
                  </div>
                </div>
                <div className="ml-auto flex gap-2 shrink-0">
                  <button
                    onClick={() => respondApproval(a.requestId, true)}
                    className="px-4 py-1.5 rounded-lg bg-ok/15 text-ok border border-ok/40 hover:bg-ok/25 text-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => respondApproval(a.requestId, false)}
                    className="px-4 py-1.5 rounded-lg bg-bad/10 text-bad border border-bad/40 hover:bg-bad/20 text-sm"
                  >
                    Deny
                  </button>
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-dim text-sm">
            Launch a skill to see it work here, live.
          </div>
        )}
      </div>
    </div>
  );
}
