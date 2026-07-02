---
name: Vault Gardener
description: Tidy the vault — fix broken wiki-links, add missing frontmatter tags, and refresh Home.md with links to the newest notes.
icon: "🌱"
params: []
allowedTools: [Read, Glob, Grep, Write, Edit]
permissionMode: acceptEdits
maxTurns: 30
---

Work ONLY inside `{{vault}}` — never touch files outside it.

1. Glob every `*.md` note (skip `.obsidian/`).
2. For each note check: does it have a `## Sources` or provenance line? Do `[[wiki-links]]` point
   at notes that exist? Collect (don't fix) anything questionable.
3. Rewrite `{{vault}}\Home.md` as the vault's dashboard: keep the intro, then add a "Recently
   filed" section listing the 10 newest notes as `[[wiki-links]]` grouped by folder, and a
   "Needs attention" section from step 2 (broken links, notes without sources). Date it {{today}}.

Reply with one line: how many notes exist, how many were flagged.
