---
name: Web Research Digest
description: Research any topic online and file a sourced digest note into the vault.
icon: "🔎"
params:
  - name: topic
    label: Topic
    type: string
    required: true
    placeholder: "e.g. best local-first sync engines 2026"
  - name: depth
    label: Depth
    type: select
    options: [quick, thorough]
    default: quick
allowedTools: [WebSearch, WebFetch, Write, Read]
permissionMode: acceptEdits
maxTurns: 30
---

Research this topic online: **{{topic}}**

Depth: {{depth}}. For "quick" do 2-3 searches and skim the best sources; for "thorough" do 5+
searches, fetch and read the strongest pages, and cross-check claims across sources.

Write the digest to `{{vault}}\Research\<topic as a short filename-safe slug> {{today}}.md`:

```markdown
# <Topic> — research digest ({{today}})

## Bottom line
<the 3-sentence answer someone actually wants>

## Key findings
- <finding> — [source name](url)

## Options / comparison   (only if the topic is a "which X" question)
| Option | Strengths | Weaknesses |

## Worth reading
- [title](url) — one line on why
```

Every claim must have a source link. Prefer primary sources and recent (2025-2026) material.
Finish by replying with the "Bottom line" section only.
