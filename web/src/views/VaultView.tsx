import { motion } from "motion/react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, fmtAgo } from "../lib/api";
import type { VaultEntry } from "../lib/types";
import { useLive } from "../lib/ws";

function Tree({
  entries,
  selected,
  onSelect,
  depth = 0,
}: {
  entries: VaultEntry[];
  selected: string | null;
  onSelect: (path: string) => void;
  depth?: number;
}) {
  return (
    <div className={depth ? "ml-3 border-l border-edge pl-2" : ""}>
      {entries.map((e) =>
        e.type === "folder" ? (
          <div key={e.path} className="my-1">
            <div className="text-xs font-semibold text-dim px-2 py-1">📁 {e.name}</div>
            <Tree entries={e.children ?? []} selected={selected} onSelect={onSelect} depth={depth + 1} />
          </div>
        ) : (
          <button
            key={e.path}
            onClick={() => onSelect(e.path)}
            className={`w-full text-left text-sm px-2 py-1 rounded-md truncate transition-colors ${
              selected === e.path ? "bg-panel2 text-accent" : "text-ink hover:bg-panel2/50"
            }`}
          >
            {e.name}
          </button>
        ),
      )}
    </div>
  );
}

export default function VaultView({ initialPath }: { initialPath?: string | null }) {
  const [tree, setTree] = useState<VaultEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(initialPath ?? null);
  const [note, setNote] = useState<{ content: string; mtimeMs: number } | null>(null);
  const { runEvents } = useLive();

  useEffect(() => {
    api.vaultTree().then((r) => setTree(r.tree)).catch(console.error);
  }, [runEvents]); // skills write notes — refresh when runs finish

  useEffect(() => {
    if (!selected) return;
    api.vaultNote(selected).then(setNote).catch(() => setNote(null));
  }, [selected, runEvents]);

  const hasNotes = (es: VaultEntry[]): boolean =>
    es.some((e) => (e.type === "note" ? true : hasNotes(e.children ?? [])));

  return (
    <div className="h-full flex">
      <div className="w-72 shrink-0 border-r border-edge p-4 overflow-y-auto">
        <h2 className="text-sm font-semibold text-dim uppercase tracking-wider px-1 mb-2">
          Obsidian Vault
        </h2>
        {!hasNotes(tree) && (
          <div className="text-sm text-dim px-1 py-3 leading-relaxed">
            Empty so far. Run a skill — briefings, research and reports get filed here as Markdown,
            readable by Obsidian.
          </div>
        )}
        <Tree entries={tree} selected={selected} onSelect={setSelected} />
      </div>
      <div className="flex-1 min-w-0 overflow-y-auto">
        {note && selected ? (
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="px-8 py-6 max-w-3xl"
          >
            <div className="text-[11px] font-mono text-dim mb-4">
              {selected} · updated {fmtAgo(note.mtimeMs)}
            </div>
            <div className="md-body text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
            </div>
          </motion.div>
        ) : (
          <div className="h-full grid place-items-center text-dim text-sm">
            Select a note to preview it.
          </div>
        )}
      </div>
    </div>
  );
}
