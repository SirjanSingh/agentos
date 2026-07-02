# 2026-07-02 (evening) — Verified live + motion polish pass

Continues `2026-07-02-initial-build.md`. **All open items from that note are done** except any
you add below.

## Verified working (live, not just typechecked)

- **Boot bug found & fixed**: Express 5 rejects `app.get("*")` → `PathError` at boot (silent
  under `concurrently`'s piped output — run `npx tsx src/index.ts` directly to see boot errors).
  Fixed to `app.get("/*splat")` in `server/src/index.ts`.
- **API**: `/api/metrics` (83 sessions warmed), `/api/skills`, `/api/runs`, vault endpoints all
  return real data. Note: there is no `/api/health` — the SPA catch-all answers unknown paths.
- **First live agent runs** (SDK runner verified at runtime): all 4 skills ran to `success` —
  repo-health ($0.29, 6m39s), research-digest, usage-report, daily-briefing. `result` fields
  (`total_cost_usd`, `num_turns`, `session_id`) land in `data/runs.jsonl`; notes appear in
  `vault/` and render in the Vault view.
- **Approval bridge E2E**: temp skill with `allowedTools:[Read]` prompted for Bash → approval
  bar appeared in Mission Control → Playwright clicked Approve → agent proceeded → success.
  (Temp skill deleted after.)
- **UI driven via Playwright** (Chrome extension wasn't connected; python playwright + headless
  chromium already installed): all 4 views, vault note preview click, no console errors (one
  benign transient WS warning on first connect).

## Motion/polish pass (this session)

- Installed `motion@12` + self-hosted fonts (`@fontsource-variable/space-grotesk`,
  `@fontsource/jetbrains-mono`). C: was at 0 GB — used `$env:npm_config_cache="D:\tmp\npm-cache"`.
- Design: "flight-deck terminal" — Space Grotesk display, JetBrains Mono telemetry, fixed
  hairline-grid + radar-glow body background, `.panel-glow` hover lift, `.caret` streaming
  cursor, `.dot-live` radar ping on running dots, `prefers-reduced-motion` respected.
- Motion: nav active-pill (`layoutId`), AnimatePresence view transitions, staggered skill-card
  entrance (`lib/motion.tsx` — shared `rise`/`stagger`/`springSnappy` + `CountUp`), animated
  sparklines, run-list layout springs, transcript message fade-ups, spring approval bar,
  count-up Analytics stat tiles.
- `npm run build` passes; bundle 893 kB (chunk-size warning still cosmetic).
- **README.md written** with screenshots in `docs/screenshots/`.

## Context / provenance

- The "guy who gave the idea": **Chase AI** — chaseai.io, YouTube `@Chase-H-AI`. His 3-step
  agentic-OS framework (domains→skills, Obsidian vault memory, observability dashboard) is
  exactly this app. **No public GitHub repo** — his materials are paid (Skool community).
- Prior art surveyed: `winfunc/opcode` (Tauri GUI), `hoangsonww/Claude-Code-Agent-Monitor`,
  `Ngxba/claude-code-cli-ui` (Nuxt), `anthropics/claude-agent-sdk-demos`. Ours differs: skills
  as manifests + vault filing + approval bridge in one.

## Second expansion pass (same evening, user asked for "more ideas, beautiful & useful")

- **Overview view** (`DeckView.tsx`, new default) — 5h/7d burn ring (prorated `windowUsage()` in
  aggregate.ts; per-event ts not kept, so sessions are prorated by time overlap), today card,
  output-tokens card, quick-launch chips, recent runs, vault activity feed. Powered by new
  `GET /api/pulse` (single call: windows + recentNotes + recentRuns + activeRuns).
- **Command palette** (`components/CommandPalette.tsx`, Ctrl+K) — views + run-skill commands,
  keyboard nav, spring entrance.
- **Cost by model** donut in Analytics — `costByModel` now tracked per session in store.ts
  (cache invalidation note: old fileCache entries lack it until file mtime changes — restart
  clears since cache is in-memory).
- **Vault deep-links**: VaultView takes `initialPath`; Overview/notes click through.
- New skill: `vault-gardener` (fix wiki-links, refresh Home.md dashboard). Not yet run.
- Prior-art/context for the burn ring: ccusage, Maciek-roboblog/Claude-Code-Usage-Monitor;
  Claude limits = 5h rolling window + weekly cap (May 2026: 5h caps doubled).

## Known issues found in live runs

- **Headless runs can die on approvals**: usage-report's Bash call waited in the approval
  bridge with no UI open → 5-min timeout → denied → run "succeeded" but wrote no report.
  Its allowedTools includes Bash, so why did canUseTool fire? Investigate (suspect: SDK still
  routes some Bash invocations through canUseTool, e.g. sub-command permission rules). Options:
  auto-approve when no WS client is connected + skill opts in, or surface pending approvals as
  a system notification.
- **`tsx watch` wedges silently** under this harness's PowerShell background shells (no output,
  never listens). Plain `npx tsx src/index.ts` works. `npm run dev`'s concurrently pipe also
  swallowed the Express PathError at boot. Consider swapping dev script to `node --watch` or
  running server foreground when debugging boot.

## Next session ideas

- Persist run transcripts server-side (still browser-session only).
- Deny-path UX test (approve path verified; deny is symmetric code but untested in UI).
- Code-split the 893 kB bundle (recharts + markdown are the heavy imports).
- More skills: session-log writer, job-hunt tracker. Point `vaultPath` at a real vault.
- **Scheduled automations** (Chase AI's third pillar): per-skill cron in `data/schedules.json`,
  server tick every minute. Deliberately not built this session — headless approval issue above
  must be solved first or scheduled runs will silently deny/burn money.
- This repo has **no git remote** — add one if it should be backed up.
