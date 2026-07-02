import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import type { SkillMeta } from "../lib/types";

export interface Command {
  id: string;
  label: string;
  icon: string;
  hint: string;
  action: () => void | Promise<void>;
}

export default function CommandPalette({
  open,
  onClose,
  navCommands,
  onRunStarted,
  onOpenSkills,
}: {
  open: boolean;
  onClose: () => void;
  navCommands: Command[];
  onRunStarted: (runId: string) => void;
  onOpenSkills: () => void;
}) {
  const [query, setQuery] = useState("");
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCursor(0);
    api.skills().then(setSkills).catch(() => {});
    // focus after the entrance animation mounts the input
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const skillCmds: Command[] = skills.map((s) => ({
      id: `run-${s.id}`,
      label: `Run: ${s.name}`,
      icon: s.icon,
      hint: s.params.some((p) => p.required && !p.default) ? "opens launchpad" : "runs now",
      action: async () => {
        if (s.params.some((p) => p.required && !p.default)) onOpenSkills();
        else onRunStarted(await api.runSkill(s.id, {}));
      },
    }));
    const all = [...navCommands, ...skillCmds];
    const q = query.trim().toLowerCase();
    return q ? all.filter((c) => c.label.toLowerCase().includes(q)) : all;
  }, [skills, navCommands, query, onRunStarted, onOpenSkills]);

  useEffect(() => setCursor(0), [query]);

  const run = async (c: Command) => {
    onClose();
    await c.action();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-bg/70 backdrop-blur-sm grid place-items-start justify-center pt-[18vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: "spring", stiffness: 480, damping: 34 }}
            className="w-[560px] max-w-[92vw] panel overflow-hidden shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") setCursor((c) => Math.min(c + 1, commands.length - 1));
                else if (e.key === "ArrowUp") setCursor((c) => Math.max(c - 1, 0));
                else if (e.key === "Enter" && commands[cursor]) void run(commands[cursor]);
                else if (e.key === "Escape") onClose();
                else return;
                e.preventDefault();
              }}
              placeholder="Jump to a view or run a skill…"
              className="w-full bg-transparent px-4 py-3.5 text-sm outline-none border-b border-edge placeholder:text-dim/60"
            />
            <div className="max-h-72 overflow-y-auto p-1.5">
              {commands.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => void run(c)}
                  onMouseEnter={() => setCursor(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left ${
                    i === cursor ? "bg-panel2 text-ink" : "text-dim"
                  }`}
                >
                  <span>{c.icon}</span>
                  {c.label}
                  <span className="ml-auto text-[10px] font-mono text-dim">{c.hint}</span>
                </button>
              ))}
              {commands.length === 0 && (
                <div className="px-3 py-4 text-sm text-dim">Nothing matches.</div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-edge text-[10px] font-mono text-dim flex gap-3">
              <span>↑↓ navigate</span>
              <span>↵ run</span>
              <span>esc close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
