import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AgentMessage, ApprovalRequest, RunRecord } from "./types";

const MAX_MESSAGES_PER_RUN = 2000;

export interface LiveState {
  connected: boolean;
  /** transcript messages per runId (SDK messages, stream_events excluded) */
  transcripts: Record<string, AgentMessage[]>;
  /** partial text currently streaming, per runId */
  liveText: Record<string, string>;
  /** run lifecycle snapshots seen over WS (merged over the REST list by consumers) */
  runEvents: Record<string, RunRecord>;
  approvals: ApprovalRequest[];
  respondApproval: (requestId: string, allow: boolean) => void;
  /** server-side "approve everything without asking" switch */
  autoApprove: boolean;
  setAutoApprove: (on: boolean) => void;
}

const Ctx = createContext<LiveState | null>(null);

export function useLive(): LiveState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLive outside WSProvider");
  return v;
}

export function WSProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [transcripts, setTranscripts] = useState<Record<string, AgentMessage[]>>({});
  const [liveText, setLiveText] = useState<Record<string, string>>({});
  const [runEvents, setRunEvents] = useState<Record<string, RunRecord>>({});
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [autoApprove, setAutoApproveState] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => setAutoApproveState(!!s.autoApprove))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let closed = false;
    let retry: number | undefined;

    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      socketRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = window.setTimeout(connect, 1500);
      };
      ws.onmessage = (ev) => {
        let msg: any;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        switch (msg.type) {
          case "run_started":
          case "run_finished":
            setRunEvents((prev) => ({ ...prev, [msg.run.id]: msg.run }));
            if (msg.type === "run_finished") {
              setLiveText((prev) => ({ ...prev, [msg.run.id]: "" }));
              setApprovals((prev) => prev.filter((a) => a.runId !== msg.run.id));
            }
            break;
          case "agent": {
            const m: AgentMessage = msg.message;
            if (m.type === "stream_event") {
              const delta = m.event?.delta;
              if (m.event?.type === "content_block_delta" && delta?.type === "text_delta") {
                setLiveText((prev) => ({
                  ...prev,
                  [msg.runId]: (prev[msg.runId] ?? "") + delta.text,
                }));
              } else if (m.event?.type === "content_block_start") {
                setLiveText((prev) => ({ ...prev, [msg.runId]: "" }));
              }
              return;
            }
            if (m.type === "assistant" || m.type === "user") {
              setLiveText((prev) => ({ ...prev, [msg.runId]: "" }));
            }
            setTranscripts((prev) => {
              const list = [...(prev[msg.runId] ?? []), m];
              if (list.length > MAX_MESSAGES_PER_RUN) list.shift();
              return { ...prev, [msg.runId]: list };
            });
            break;
          }
          case "approval_request":
            setApprovals((prev) => [...prev, msg as ApprovalRequest]);
            break;
          case "approval_resolved":
            setApprovals((prev) => prev.filter((a) => a.requestId !== msg.requestId));
            break;
          case "settings":
            setAutoApproveState(!!msg.settings?.autoApprove);
            break;
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socketRef.current?.close();
    };
  }, []);

  const respondApproval = useCallback((requestId: string, allow: boolean) => {
    socketRef.current?.send(
      JSON.stringify({ type: "approval_response", requestId, behavior: allow ? "allow" : "deny" }),
    );
    setApprovals((prev) => prev.filter((a) => a.requestId !== requestId));
  }, []);

  const setAutoApprove = useCallback((on: boolean) => {
    setAutoApproveState(on); // optimistic; server broadcast confirms
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoApprove: on }),
    }).catch(() => {});
  }, []);

  return (
    <Ctx.Provider
      value={{
        connected,
        transcripts,
        liveText,
        runEvents,
        approvals,
        respondApproval,
        autoApprove,
        setAutoApprove,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
