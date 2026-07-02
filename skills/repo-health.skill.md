---
name: Repo Health Sweep
description: Scan every repo under D:\projs — dirty trees, unpushed commits, stale branches — and file a status board into the vault.
icon: "🩺"
params: []
allowedTools: [Read, Glob, Write, Bash]
permissionMode: acceptEdits
maxTurns: 40
---

Sweep every direct subdirectory of `{{projectsRoot}}` that contains a `.git` folder. For each repo
run READ-ONLY git commands (never fetch, pull, push, or mutate):

- `git -C <repo> status --porcelain` → count of dirty files
- `git -C <repo> log --oneline -1 --format="%h %cr %s"` → last commit + age
- `git -C <repo> rev-parse --abbrev-ref HEAD` → current branch
- `git -C <repo> log --branches --not --remotes --oneline` → unpushed commit count (if no remote,
  mark "no remote")

Prefer batching with a single PowerShell loop over per-repo calls where you can.

Write the board to `{{vault}}\Skill Runs\Repo Health {{today}}.md`:

```markdown
# Repo Health — {{today}}

| Repo | Branch | Dirty | Unpushed | Last commit | Status |
|------|--------|-------|----------|-------------|--------|
| ...  | ...    | 3     | 2        | 4 days ago  | 🔴 needs attention |
```

Status legend: 🟢 clean & pushed · 🟡 dirty or unpushed · 🔴 dirty AND unpushed, or last commit
older than 30 days with dirty files. After the table add an **Action items** list naming the 3
worst offenders and the exact commands to fix each.

Finish by replying with just the counts (X clean / Y yellow / Z red) and the top action item.
