# Session Timeline

Paste an agent or chat session log → get a **clean shareable vertical timeline card** (PNG + copy text).

Receipt is a stamp of what happened. **Timeline is the story of the run** — a vertical spine of USER / AGENT / TOOL / ERROR / DONE events you can screenshot and post.

**Paste a session. Print the spine. Share the story — not the log.**

[![MIT License](https://img.shields.io/badge/license-MIT-00D4FF?labelColor=0A0F1F)](LICENSE)

SMF Works viral kit:

1. **[Agent Receipt](https://github.com/smfworks/agent-receipt)** — stamp of what happened
2. **Session Timeline (this)** — the run as a vertical spine
3. **[Refuse Card](https://github.com/smfworks/refuse-card)** — GO / HOLD / NO
4. **[Tool Permit](https://github.com/smfworks/tool-permit)** — GO-list / allowlist
5. **[Agent Contract](https://github.com/smfworks/agent-contract)** — roles, success, stop
6. **[Skill Lint](https://github.com/smfworks/skill-lint)** — grade a SKILL.md
7. **[Paste → Skill](https://github.com/smfworks/paste-to-skill)** — notes → SKILL.md
8. **[Prompt Diff](https://github.com/smfworks/prompt-diff)** — what changed
9. **[Skill Card](https://github.com/smfworks/skill-card)** — skill one-pager
10. **[Redact Before Share](https://github.com/smfworks/redact-before-share)** — scrub secrets/PII
11. **[Context Budget](https://github.com/smfworks/context-budget)** — what to cut

## Why a timeline card?

Agent work disappears into chat scrolls. A receipt counts the tools. A timeline **narrates the path**: who asked, what ran, where it broke, how it ended.

It is a lab artifact, not an audit log. **Heuristic parser. Approximate labels. Judgment stays human.**

## Quickstart

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

```bash
npm run build
npm run preview
npm test
```

Node 20+ (22 recommended). Client-side only — no auth, no backend, no API keys, no secrets leave the browser.

## Use it

1. Pick **PR fix**, **Research**, **Failed deploy**, or **Tool-heavy**, or paste a transcript / JSON.
2. Optional **title**, **agent name**, and **date** overlay the meta line.
3. The card updates live — a vertical spine, type badges, timestamps or step numbers, one-line summaries. Long runs collapse with **+N more** (last DONE stays visible).
4. **Download PNG**, **Copy share text**, or **Copy JSON**. **Reset** clears the compositor.

Load a sample from the URL: `?sample=successful-pr-fix`.

## Samples

Shipped in [`public/samples/`](public/samples/):

| File | What it shows |
| --- | --- |
| `successful-pr-fix.json` | CI red → patch → tests green → PR |
| `research-then-summarize.json` | Search / read / one-pager |
| `failed-deploy-retry.json` | Deploy error, retry, hold for human |
| `tool-heavy-debug.json` | Grep / read / shell, overflow + DONE |

## Input / output schema

Canonical JSON Schema: [`public/schema/session-timeline.schema.json`](public/schema/session-timeline.schema.json)

Minimal card:

```json
{
  "title": "Successful PR fix",
  "agent": "Cursor",
  "date": "2026-09-18",
  "events": [
    { "type": "USER", "summary": "CI is red on main — open a PR" },
    { "type": "TOOL", "summary": "gh run view --log" },
    { "type": "DONE", "summary": "Draft PR open. Tests green." }
  ]
}
```

Printed output:

| Field | Notes |
| --- | --- |
| `schema` | `smf.session-timeline.v1` |
| `id` | `ST-xxxx` serial |
| `title` | Headline on the card |
| `agent` | Agent / model on the meta line |
| `date` | Session date |
| `events` | `{ type, summary, at?, step }` — `USER` · `AGENT` · `TOOL` · `ERROR` · `DONE` |
| `heuristic` | Always `true` — this is a demo parser |

Paste also understands a labeled log:

```
title: Successful PR fix
agent: Cursor
User: CI is red on main
Assistant: Inspecting the failing check
[tool] gh run view --log
Error: TypeError: Cannot read properties of undefined
Done: PR opened. Tests green.
```

Messy transcripts are parsed heuristically (role prefixes, tool lines, error keywords, “PR opened” / “tests pass”). Prefer JSON when you control the emitter. The parser will be wrong sometimes. That is why the card is a shareable story, not an audit.

## Host a demo

Static files from `npm run build` (output: `dist/`). `vercel.json` rewrites unknown paths to `index.html` for SPA hosting.

Or Docker:

```bash
docker build -t session-timeline .
docker run --rm -p 8080:80 session-timeline
```

Then open [http://localhost:8080](http://localhost:8080).

## Stack

Vite + React + TypeScript. Parsing is client-side heuristics (no model, no keys). PNG export via `html-to-image`. Fonts: Inter, Space Grotesk, JetBrains Mono. Palette: navy `#0A0F1F`, cyan `#00D4FF`, GO green `#34D399`.

## Built by SMF Works

[SMF Works](https://smfworks.com) is a human-AI research lab. We publish what we learn, ship open agent tools, and install stacks on hardware you own.

Intelligence is abundant. Judgment is the product.

- Lab: [smfworks.com](https://smfworks.com)
- GitHub: [github.com/smfworks](https://github.com/smfworks)
- X: [@MichaelGannotti](https://x.com/MichaelGannotti)
- Twin: [Agent Receipt](https://github.com/smfworks/agent-receipt) — what happened

MIT licensed. **Not an audit. Not a compliance product.** This is a shareable timeline card, not a hosted agent.

## License

[MIT](LICENSE) © 2026 SMF Works
