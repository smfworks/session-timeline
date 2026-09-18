import type { SampleMeta } from "../types.ts";

export const SAMPLES: SampleMeta[] = [
  {
    id: "successful-pr-fix",
    file: "/samples/successful-pr-fix.json",
    label: "PR fix",
    blurb: "CI red → patch → PR",
  },
  {
    id: "research-then-summarize",
    file: "/samples/research-then-summarize.json",
    label: "Research",
    blurb: "Search → read → brief",
  },
  {
    id: "failed-deploy-retry",
    file: "/samples/failed-deploy-retry.json",
    label: "Failed deploy",
    blurb: "Push → error → retry",
  },
  {
    id: "tool-heavy-debug",
    file: "/samples/tool-heavy-debug.json",
    label: "Tool-heavy",
    blurb: "Grep / read / shell",
  },
];

export const PASTE_PLACEHOLDER = `Paste a chat transcript, agent log, or JSON.

User: The CI check is red on main. Find the failure and open a PR.
Assistant: I'll inspect the failing job, then patch and verify.
[tool] gh run view --log
Error: TypeError: Cannot read properties of undefined
tool: StrReplace src/lib/parse.ts
Done: PR opened. Tests green.
`;
