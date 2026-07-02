import crypto from "node:crypto";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SkillManifest } from "../skills/loader.js";
import { renderPrompt } from "../skills/loader.js";
import { saveRun, type RunRecord } from "../skills/runstore.js";

export type Broadcast = (msg: unknown) => void;

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

interface ActiveRun {
  record: RunRecord;
  interrupt: () => Promise<void>;
}

const activeRuns = new Map<string, ActiveRun>();
const pendingApprovals = new Map<string, (allow: boolean) => void>();

/** When on, tool calls outside a skill's allowlist are approved without asking (in-memory, off on boot). */
let autoApproveAll = false;
export const getAutoApprove = () => autoApproveAll;
export const setAutoApprove = (on: boolean) => {
  autoApproveAll = on;
};

export function resolveApproval(requestId: string, allow: boolean): boolean {
  const resolve = pendingApprovals.get(requestId);
  if (!resolve) return false;
  resolve(allow);
  return true;
}

export async function stopRun(runId: string): Promise<boolean> {
  const active = activeRuns.get(runId);
  if (!active) return false;
  await active.interrupt().catch(() => {});
  return true;
}

export function activeRunIds(): string[] {
  return [...activeRuns.keys()];
}

export function startRun(
  skill: SkillManifest,
  params: Record<string, string>,
  broadcast: Broadcast,
): RunRecord {
  const record: RunRecord = {
    id: crypto.randomUUID().slice(0, 8),
    skillId: skill.id,
    skillName: skill.name,
    params,
    status: "running",
    startedAt: Date.now(),
    toolCalls: 0,
  };
  saveRun(record);
  broadcast({ type: "run_started", run: record });

  void executeRun(skill, params, record, broadcast);
  return record;
}

async function executeRun(
  skill: SkillManifest,
  params: Record<string, string>,
  record: RunRecord,
  broadcast: Broadcast,
): Promise<void> {
  const prompt = renderPrompt(skill, params);

  const q = query({
    prompt,
    options: {
      cwd: skill.cwd,
      model: skill.model,
      maxTurns: skill.maxTurns,
      permissionMode: skill.permissionMode,
      allowedTools: skill.allowedTools,
      includePartialMessages: true,
      // don't inherit the user's global skills/CLAUDE.md — skills are self-contained
      settingSources: [],
      systemPrompt: { type: "preset", preset: "claude_code" },
      canUseTool: async (toolName: string, input: Record<string, unknown>) => {
        if (autoApproveAll) {
          broadcast({ type: "auto_approved", runId: record.id, toolName });
          return { behavior: "allow" as const, updatedInput: input };
        }
        const requestId = crypto.randomUUID().slice(0, 8);
        broadcast({
          type: "approval_request",
          runId: record.id,
          requestId,
          toolName,
          input,
        });
        const allow = await new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => {
            pendingApprovals.delete(requestId);
            resolve(false);
          }, APPROVAL_TIMEOUT_MS);
          pendingApprovals.set(requestId, (ok) => {
            clearTimeout(timer);
            pendingApprovals.delete(requestId);
            resolve(ok);
          });
        });
        broadcast({ type: "approval_resolved", runId: record.id, requestId, allowed: allow });
        return allow
          ? { behavior: "allow" as const, updatedInput: input }
          : { behavior: "deny" as const, message: "Denied from the AgentOS dashboard" };
      },
    },
  });

  activeRuns.set(record.id, { record, interrupt: () => q.interrupt() });

  try {
    for await (const message of q as AsyncIterable<any>) {
      // count tool calls for the run card stats
      if (message.type === "assistant" && Array.isArray(message.message?.content)) {
        for (const block of message.message.content) {
          if (block?.type === "tool_use") record.toolCalls++;
        }
      }
      broadcast({ type: "agent", runId: record.id, message });

      if (message.type === "result") {
        record.endedAt = Date.now();
        record.durationMs = message.duration_ms ?? record.endedAt - record.startedAt;
        record.costUSD = message.total_cost_usd;
        record.numTurns = message.num_turns;
        record.sessionId = message.session_id;
        if (message.usage) {
          record.usage = {
            input: message.usage.input_tokens ?? 0,
            output: message.usage.output_tokens ?? 0,
            cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
            cacheRead: message.usage.cache_read_input_tokens ?? 0,
          };
        }
        if (message.subtype === "success") {
          record.status = "success";
          record.resultText = typeof message.result === "string" ? message.result : "";
        } else {
          record.status = "error";
          record.error = message.subtype;
        }
      }
    }
    // stream ended without a result message → interrupted
    if (record.status === "running") {
      record.status = "cancelled";
      record.endedAt = Date.now();
      record.durationMs = record.endedAt - record.startedAt;
    }
  } catch (err) {
    record.status = "error";
    record.error = err instanceof Error ? err.message : String(err);
    record.endedAt = Date.now();
    record.durationMs = record.endedAt - record.startedAt;
  } finally {
    activeRuns.delete(record.id);
    saveRun(record);
    broadcast({ type: "run_finished", run: record });
  }
}
