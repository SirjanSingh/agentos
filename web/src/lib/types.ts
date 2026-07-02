export interface SkillParam {
  name: string;
  label: string;
  type: "string" | "select";
  options?: string[];
  default?: string;
  required?: boolean;
  placeholder?: string;
}

export interface SkillMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
  params: SkillParam[];
  cwd: string;
  allowedTools: string[];
  permissionMode: string;
  model?: string;
}

export interface Usage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface RunRecord {
  id: string;
  skillId: string;
  skillName: string;
  params: Record<string, string>;
  status: "running" | "success" | "error" | "cancelled";
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  costUSD?: number;
  usage?: Usage;
  numTurns?: number;
  toolCalls: number;
  sessionId?: string;
  resultText?: string;
  error?: string;
}

export interface ApprovalRequest {
  runId: string;
  requestId: string;
  toolName: string;
  input: Record<string, unknown>;
}

/** Raw message from the Agent SDK, relayed by the server. Shape varies by type. */
export type AgentMessage = Record<string, any>;

export interface MetricsResponse {
  days: number;
  includeAgentOS: boolean;
  costIsEstimate: boolean;
  summary: {
    totalCostUSD: number;
    totalSessions: number;
    totalPrompts: number;
    totalToolCalls: number;
    totalInput: number;
    totalOutput: number;
    totalCacheRead: number;
    activeDays: number;
    models: string[];
  };
  daily: Array<{
    date: string;
    costUSD: number;
    input: number;
    output: number;
    cacheRead: number;
    sessions: number;
    toolCalls: number;
    prompts: number;
  }>;
  projects: Array<{
    project: string;
    sessions: number;
    costUSD: number;
    tokens: number;
    toolCalls: number;
    lastActive: number;
  }>;
  tools: Array<{ name: string; count: number }>;
  heatmap: number[][];
  models: Array<{ model: string; costUSD: number }>;
}

export interface WindowUsage {
  costUSD: number;
  output: number;
  sessions: number;
}

export interface PulseResponse {
  window5h: WindowUsage;
  window7d: WindowUsage;
  today: MetricsResponse["summary"];
  recentNotes: Array<{ name: string; path: string; mtimeMs: number }>;
  recentRuns: RunRecord[];
  activeRuns: number;
  costIsEstimate: boolean;
}

export interface VaultEntry {
  name: string;
  path: string;
  type: "folder" | "note";
  children?: VaultEntry[];
  mtimeMs?: number;
}
