import type { SessionStats } from "./store.js";

export interface DailyPoint {
  date: string; // YYYY-MM-DD local
  costUSD: number;
  input: number;
  output: number;
  cacheRead: number;
  sessions: number;
  toolCalls: number;
  prompts: number;
}

export interface ProjectRow {
  project: string;
  sessions: number;
  costUSD: number;
  tokens: number; // input+output (cache excluded — it dwarfs everything)
  toolCalls: number;
  lastActive: number;
}

export interface Summary {
  totalCostUSD: number;
  totalSessions: number;
  totalPrompts: number;
  totalToolCalls: number;
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  activeDays: number;
  models: string[];
}

function localDate(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function toolTotal(s: SessionStats): number {
  return Object.values(s.toolCounts).reduce((a, b) => a + b, 0);
}

export function filterSessions(
  sessions: SessionStats[],
  opts: { days?: number; includeAgentOS?: boolean },
): SessionStats[] {
  const cutoff = opts.days ? Date.now() - opts.days * 86_400_000 : 0;
  return sessions.filter(
    (s) => s.lastTs >= cutoff && (opts.includeAgentOS || !s.isAgentOS),
  );
}

export function summarize(sessions: SessionStats[]): Summary {
  const models = new Set<string>();
  const days = new Set<string>();
  const sum: Summary = {
    totalCostUSD: 0,
    totalSessions: sessions.length,
    totalPrompts: 0,
    totalToolCalls: 0,
    totalInput: 0,
    totalOutput: 0,
    totalCacheRead: 0,
    activeDays: 0,
    models: [],
  };
  for (const s of sessions) {
    sum.totalCostUSD += s.costUSD;
    sum.totalPrompts += s.userPrompts;
    sum.totalToolCalls += toolTotal(s);
    sum.totalInput += s.usage.input;
    sum.totalOutput += s.usage.output;
    sum.totalCacheRead += s.usage.cacheRead;
    days.add(localDate(s.firstTs));
    for (const m of s.models) models.add(m);
  }
  sum.activeDays = days.size;
  sum.models = [...models].sort();
  return sum;
}

export function dailySeries(sessions: SessionStats[], days: number): DailyPoint[] {
  const byDate = new Map<string, DailyPoint>();
  const start = Date.now() - (days - 1) * 86_400_000;
  for (let i = 0; i < days; i++) {
    const date = localDate(start + i * 86_400_000);
    byDate.set(date, {
      date,
      costUSD: 0,
      input: 0,
      output: 0,
      cacheRead: 0,
      sessions: 0,
      toolCalls: 0,
      prompts: 0,
    });
  }
  for (const s of sessions) {
    // attribute whole session to its start day — good enough at day granularity
    const p = byDate.get(localDate(s.firstTs));
    if (!p) continue;
    p.costUSD += s.costUSD;
    p.input += s.usage.input;
    p.output += s.usage.output;
    p.cacheRead += s.usage.cacheRead;
    p.sessions += 1;
    p.toolCalls += toolTotal(s);
    p.prompts += s.userPrompts;
  }
  return [...byDate.values()];
}

export function projectRows(sessions: SessionStats[]): ProjectRow[] {
  const byProject = new Map<string, ProjectRow>();
  for (const s of sessions) {
    let row = byProject.get(s.project);
    if (!row) {
      row = { project: s.project, sessions: 0, costUSD: 0, tokens: 0, toolCalls: 0, lastActive: 0 };
      byProject.set(s.project, row);
    }
    row.sessions += 1;
    row.costUSD += s.costUSD;
    row.tokens += s.usage.input + s.usage.output;
    row.toolCalls += toolTotal(s);
    row.lastActive = Math.max(row.lastActive, s.lastTs);
  }
  return [...byProject.values()].sort((a, b) => b.costUSD - a.costUSD);
}

export function toolBreakdown(sessions: SessionStats[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    for (const [name, n] of Object.entries(s.toolCounts)) {
      counts.set(name, (counts.get(name) ?? 0) + n);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** 7x24 matrix (Mon..Sun x hour) of assistant activity, weighted by message count. */
export function activityHeatmap(sessions: SessionStats[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const s of sessions) {
    const d = new Date(s.firstTs);
    const weekday = (d.getDay() + 6) % 7; // Monday = 0
    grid[weekday][d.getHours()] += s.assistantMsgs;
  }
  return grid;
}
