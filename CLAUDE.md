# CLAUDE.md

**Session protocol:** read the newest note in `docs/sessions/` first — it records exact project
state and what to do next. Update it (or create today's) before ending a session.

AgentOS is a local "visual agentic OS": a clickable dashboard that wraps Claude Code via the
official `@anthropic-ai/claude-agent-sdk`, turns daily workflows into one-click skills, shows
metrics the terminal can't (cost/token charts, per-skill stats, live agent streams), and files
outputs into the Obsidian vault at `vault/`.

## Commands

```bash
npm install            # workspaces: server + web
npm run dev            # server :4310 (API + WS) and web :4311 (Vite, proxies /api + /ws)
npm run build          # typecheck + build both workspaces
```

## Architecture

- `server/` — Node + TS (tsx runtime). `src/index.ts` boots Express + a `ws` WebSocket hub.
  - `src/agent/runner.ts` — wraps Agent SDK `query()`; every SDK message is broadcast over WS as
    `{type:'agent', runId, message}`. `canUseTool` bridges to the UI as `approval_request` /
    `approval_response` (5-min timeout → deny). Run records append to `data/runs.jsonl`.
  - `src/metrics/` — parses `~/.claude/projects/**/*.jsonl` + `history.jsonl` (mtime-cached).
    Cost is *estimated* from a per-model price table. Sessions whose `cwd` is inside this repo
    are tagged `isAgentOS` and excluded from analytics by default (feedback-loop guard).
  - `src/skills/` — loads `skills/*.skill.md` manifests (YAML frontmatter + prompt template body,
    `{{param}}` substitution; `{{vault}}`, `{{projectsRoot}}`, `{{today}}` are auto-injected).
  - `src/obsidian/vault.ts` — vault init + tree/read API, path-traversal guarded.
- `web/` — React + Vite + Tailwind v4 + Recharts. Views: MissionControl (live transcript,
  approve/deny), Skills (launchpad cards), Analytics (charts), Vault (tree + markdown preview).
- `skills/*.skill.md` — a skill is a manifest, not code. Add a file → it appears in the UI.
- All paths/ports come from `agentos.config.json` (vault is repointable to a real Obsidian vault).

## Conventions

- Commits are authored as **Sirjan Singh, no Co-Authored-By trailers**.
- The Agent SDK uses the local Claude Code login — no API key in this repo.
- Skills run with explicit `allowedTools`; anything outside goes through the UI approval bridge.
  Never grant `bypassPermissions` to a skill that can write outside this repo/vault.
