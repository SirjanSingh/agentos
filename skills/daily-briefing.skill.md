---
name: Daily Briefing
description: Summarize yesterday's Claude Code sessions + git activity across all projects into a daily note in the vault.
icon: "📰"
params: []
allowedTools: [Read, Grep, Glob, Write, Bash, PowerShell]
permissionMode: acceptEdits
maxTurns: 40
---

Today is {{today}}. Write my daily briefing note covering YESTERDAY (the calendar day before {{today}}).

Gather two sources of truth:

1. **What I asked Claude to do**: read the tail of `{{claudeHome}}\history.jsonl` (each line is
   `{"display": <prompt>, "timestamp": <epoch ms>, "project": <path>}`). Filter to yesterday's
   timestamps. Group prompts by project. The file can be large — read only what you need
   (e.g. last ~500 lines via PowerShell `Get-Content -Tail`).
2. **What actually shipped**: for each project directory directly under `{{projectsRoot}}` that is
   a git repo AND had prompts yesterday (plus any repo with commits yesterday), run
   `git -C <repo> log --since=yesterday.midnight --until=midnight --oneline --author=Sirjan` (fall
   back to all authors if empty). Skip repos with no activity. Do not modify any repo.

Then write the note to `{{vault}}\Daily\{{today}}.md` (create folders if needed) in this shape:

```markdown
# Daily Briefing — <yesterday's date>

## TL;DR
<2-4 sentences: main thrust of the day>

## By project
### <project>
- **Asked:** <themes of the prompts, not a raw dump>
- **Shipped:** <commits / outcomes>

## Open threads
- <things that looked unfinished or blocked, judging from the prompts>
```

If yesterday had zero activity, still write the note saying so. Finish by replying with the TL;DR
section only.
