---
name: Usage & Cost Report
description: Turn the last 30 days of Claude Code metrics into a narrative report with recommendations, filed to the vault.
icon: "📊"
params: []
allowedTools: [Read, Write, Bash]
permissionMode: acceptEdits
maxTurns: 20
---

Fetch my Claude Code usage metrics from the local AgentOS server (PowerShell):

```
Invoke-RestMethod "http://localhost:4310/api/metrics?days=30" | ConvertTo-Json -Depth 6
```

The JSON has: `summary` (totals), `daily` (per-day cost/tokens/sessions), `projects` (per-project
spend), `tools` (tool-call breakdown), `heatmap` (weekday x hour activity). Costs are estimates.

Write an analyst-grade narrative to `{{vault}}\Dashboards\Usage Report {{today}}.md`:

1. **Headline numbers** — 30-day est. cost, sessions, prompts, output tokens, active days.
2. **Where the money goes** — top projects by cost, and whether spend matches where my attention
   should be.
3. **Rhythm** — busiest weekdays/hours from the heatmap; cost trend (rising/falling week over week
   from `daily`).
4. **Tool habits** — what the tool breakdown says about how I work (e.g. heavy Bash vs Read).
5. **Three concrete recommendations** — e.g. cheaper model for X, batch Y, cache Z. Be specific,
   not generic.

Finish by replying with the headline numbers and your #1 recommendation.
