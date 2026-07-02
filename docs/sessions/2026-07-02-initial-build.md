# 2026-07-02 — Initial build (stopped mid-verification, resume here)

## What this project is

AgentOS: a local "visual agentic OS" — clickable dashboard wrapping Claude Code via
`@anthropic-ai/claude-agent-sdk`, one-click skills with metrics the terminal can't show, outputs
filed into the Obsidian vault at `vault/`. Approved plan (context + architecture + decisions):
`C:\Users\Sirjan\.claude\plans\work-in-a-new-purring-prism.md`. Conventions: `CLAUDE.md`.

## State: CODE COMPLETE, VERIFICATION NOT STARTED

Everything compiles (`npm run build` passes both workspaces; web bundles 758 kB). **Nothing has
been run against a live server yet.** The user asked to stop right before verification.

### Done this session
- Scaffold: npm workspaces (`server`, `web`), `agentos.config.json` (all paths repointable),
  vault folder structure, CLAUDE.md, git init (author Sirjan Singh).
- `server/` (Express 5 + ws + tsx): config loader, **metrics engine** (`src/metrics/` — parses
  `~/.claude/projects/**/*.jsonl` with mtime cache; verified the real event shape against a live
  session file: `message.usage.{input_tokens,cache_creation_input_tokens,cache_read_input_tokens,
  output_tokens}`, top-level `timestamp`/`cwd`; est. pricing table in `pricing.ts`), **agent
  runner** (`src/agent/runner.ts` — SDK `query()` with `includePartialMessages`,
  `settingSources: []` to avoid the 1295-skill context bloat, `canUseTool` → WS approval bridge
  with 5-min deny timeout), **skill loader** (`src/skills/loader.ts` — gray-matter frontmatter,
  `{{param}}` + `{{vault}}/{{projectsRoot}}/{{claudeHome}}/{{today}}` substitution), append-only
  run store (`data/runs.jsonl`, last-record-per-id wins), **vault module** (`src/obsidian/` —
  ensureVault seeds `.obsidian/`, traversal-guarded tree/read API).
- `skills/`: 4 manifests — daily-briefing, repo-health (read-only git), usage-report (calls own
  API at :4310), research-digest (topic/depth params).
- `web/` (React + Vite 8 + Tailwind v4 + Recharts): WS store (`lib/ws.tsx` — transcripts per run,
  streaming text via `content_block_delta`, approvals), views MissionControl / SkillsView /
  AnalyticsView (cost area, project bars, tool donut, weekday×hour heatmap) / VaultView.
- Env fixes this session: freed disk (npm cache clean recovered ~2.3 GB on D:, was 0.3 GB free!);
  both drives run near-full — **check free space before installs**.

## Open items (next session, in order)

1. **Boot check**: `npm run dev` → wait for `[agentos] server on http://localhost:4310` in output,
   then `Invoke-RestMethod http://localhost:4310/api/metrics?days=7`. My one smoke test hit
   "unable to connect" ~6 s after starting — likely just checked too early (tsx + vite cold
   start); if not, read the dev output for a boot error. Nothing is diagnosed yet.
2. **Verify Analytics against reality**: cross-check one day's token totals vs a raw session
   JSONL; open http://localhost:4311 in the browser and drive all 4 views.
3. **First live agent run**: the runner is written against the documented SDK API but never
   executed — verify at runtime: `canUseTool` result shape (`{behavior:'allow', updatedInput}`),
   `result` message fields (`total_cost_usd`, `num_turns`, `session_id`), `q.interrupt()`, and
   that the CLI login is picked up. Start with Repo Health (read-only, no params).
4. **Run all 4 skills end-to-end**: watch Mission Control stream, approve/deny at least one
   permission, confirm notes land in `vault/` and render in the Vault view; confirm run records
   append to `data/runs.jsonl` and Launchpad stats update.
5. **README** with screenshots + polish pass (empty states, chunk-size warning is cosmetic).
6. Ideas parked: run transcripts persisted server-side (currently browser-session only), more
   skills (session-log writer, job-hunt tracker), point `vaultPath` at a real vault when Obsidian
   gets installed.

## Gotchas discovered

- Express 5 types: `req.params.x` is `string | string[]` — wrap in `String()`.
- Vite: needs `src/vite-env.d.ts` (`/// <reference types="vite/client" />`) or CSS imports fail
  typecheck.
- `.obsidian/` seed is created by the server on boot (`ensureVault()`), so the vault folder in git
  is empty until first run — that's expected.
