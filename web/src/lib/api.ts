import type { MetricsResponse, PulseResponse, RunRecord, SkillMeta, VaultEntry } from "./types";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  skills: () => get<SkillMeta[]>("/api/skills"),
  runs: () => get<{ runs: RunRecord[]; active: string[] }>("/api/runs"),
  metrics: (days: number, includeAgentOS: boolean) =>
    get<MetricsResponse>(`/api/metrics?days=${days}&includeAgentOS=${includeAgentOS}`),
  pulse: () => get<PulseResponse>("/api/pulse"),
  vaultTree: () => get<{ tree: VaultEntry[] }>("/api/vault/tree"),
  vaultNote: (path: string) =>
    get<{ path: string; content: string; mtimeMs: number }>(
      `/api/vault/note?path=${encodeURIComponent(path)}`,
    ),
  runSkill: async (id: string, params: Record<string, string>): Promise<string> => {
    const res = await fetch(`/api/skills/${id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ params }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? `run failed: ${res.status}`);
    return (await res.json()).runId as string;
  },
  stopRun: (id: string) => fetch(`/api/runs/${id}/stop`, { method: "POST" }),
};

export const fmtUSD = (n: number | undefined) =>
  n == null ? "—" : `$${n >= 100 ? n.toFixed(0) : n.toFixed(2)}`;

export const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

export const fmtDuration = (ms: number | undefined) => {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

export const fmtAgo = (ts: number) => {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
