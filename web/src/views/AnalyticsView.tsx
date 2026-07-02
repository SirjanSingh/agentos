import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, fmtTokens, fmtUSD } from "../lib/api";
import type { MetricsResponse } from "../lib/types";

const COLORS = ["#37d0ee", "#8b7cf6", "#34d399", "#fbbf24", "#f87171", "#f472b6", "#a3e635", "#60a5fa"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const tooltipStyle = {
  backgroundColor: "#0d1220",
  border: "1px solid #1c2740",
  borderRadius: 8,
  fontSize: 12,
} as const;

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel px-5 py-4">
      <div className="text-[11px] uppercase tracking-wider text-dim">{label}</div>
      <div className="text-2xl font-semibold mt-1 font-mono">{value}</div>
      {sub && <div className="text-[11px] text-dim mt-0.5">{sub}</div>}
    </div>
  );
}

function Heatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat());
  return (
    <div className="space-y-1">
      {grid.map((row, d) => (
        <div key={d} className="flex items-center gap-1">
          <span className="w-8 text-[10px] font-mono text-dim">{WEEKDAYS[d]}</span>
          {row.map((v, h) => (
            <div
              key={h}
              title={`${WEEKDAYS[d]} ${h}:00 — ${v} messages`}
              className="flex-1 aspect-square rounded-[3px] min-w-0"
              style={{
                backgroundColor: v === 0 ? "#121a2e" : `rgba(55, 208, 238, ${0.15 + 0.85 * (v / max)})`,
              }}
            />
          ))}
        </div>
      ))}
      <div className="flex items-center gap-1 pl-9 text-[9px] font-mono text-dim">
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="flex-1 text-center min-w-0">
            {h % 6 === 0 ? h : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsView() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [days, setDays] = useState(30);
  const [includeAgentOS, setIncludeAgentOS] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api.metrics(days, includeAgentOS).then(setData).catch((e) => setError(String(e)));
  }, [days, includeAgentOS]);

  const dailyChart = useMemo(
    () =>
      (data?.daily ?? []).map((d) => ({
        ...d,
        label: d.date.slice(5),
        outputK: Math.round(d.output / 1000),
      })),
    [data],
  );

  if (error) {
    return <div className="p-8 text-bad text-sm font-mono">metrics failed: {error}</div>;
  }
  if (!data) return <div className="p-8 text-dim text-sm animate-pulse">crunching sessions…</div>;

  const s = data.summary;
  const topTools = data.tools.slice(0, 8);

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold">Analytics</h1>
          <p className="text-sm text-dim mt-0.5">
            Real numbers from <code className="font-mono">~/.claude</code> · costs are estimates
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-dim">
            <input
              type="checkbox"
              checked={includeAgentOS}
              onChange={(e) => setIncludeAgentOS(e.target.checked)}
              className="accent-cyan-400"
            />
            include AgentOS runs
          </label>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                days === d
                  ? "bg-accent/15 text-accent border-accent/40"
                  : "text-dim border-edge hover:text-ink"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatCard label="Est. cost" value={fmtUSD(s.totalCostUSD)} sub={`${days} days`} />
        <StatCard label="Sessions" value={String(s.totalSessions)} sub={`${s.activeDays} active days`} />
        <StatCard label="Prompts" value={String(s.totalPrompts)} />
        <StatCard label="Tool calls" value={fmtTokens(s.totalToolCalls)} />
        <StatCard label="Output tokens" value={fmtTokens(s.totalOutput)} />
        <StatCard label="Cache reads" value={fmtTokens(s.totalCacheRead)} sub="tokens" />
      </div>

      <div className="panel p-5">
        <h3 className="text-sm font-semibold mb-3">Daily est. cost</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={dailyChart}>
            <defs>
              <linearGradient id="cost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#37d0ee" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#37d0ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1c2740" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#6b7a99", fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: "#6b7a99", fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="costUSD"
              name="est. $"
              stroke="#37d0ee"
              fill="url(#cost)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="panel p-5">
          <h3 className="text-sm font-semibold mb-3">Cost by project</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.projects.slice(0, 10)} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke="#1c2740" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#6b7a99", fontSize: 10 }} tickLine={false} />
              <YAxis
                type="category"
                dataKey="project"
                width={110}
                tick={{ fill: "#dbe4f5", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="costUSD" name="est. $" radius={[0, 4, 4, 0]}>
                {data.projects.slice(0, 10).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel p-5">
          <h3 className="text-sm font-semibold mb-3">Tool usage</h3>
          <div className="flex items-center">
            <ResponsiveContainer width="55%" height={260}>
              <PieChart>
                <Pie
                  data={topTools}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  stroke="none"
                >
                  {topTools.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 text-xs font-mono flex-1">
              {topTools.map((t, i) => (
                <div key={t.name} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="truncate">{t.name}</span>
                  <span className="ml-auto text-dim">{fmtTokens(t.count)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <h3 className="text-sm font-semibold mb-3">When you work (assistant activity)</h3>
        <Heatmap grid={data.heatmap} />
      </div>
    </div>
  );
}
