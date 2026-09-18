import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCompactStats, formatShareText } from "./share.ts";
import type { SessionTimeline } from "../types.ts";

const card: SessionTimeline = {
  schema: "smf.session-timeline.v1",
  id: "ST-TEST",
  title: "Successful PR fix",
  agent: "Cursor",
  date: "18 Sep 2026",
  heuristic: true,
  events: [
    { type: "USER", summary: "Fix CI", step: 1, at: "13:02" },
    { type: "TOOL", summary: "npm test", step: 2 },
    { type: "DONE", summary: "PR open", step: 3 },
  ],
};

describe("share text", () => {
  it("includes title, types, and the sibling line", () => {
    const text = formatShareText(card);
    assert.match(text, /Session Timeline/);
    assert.match(text, /Successful PR fix/);
    assert.match(text, /USER/);
    assert.match(text, /Receipt is a stamp/);
    assert.match(text, /github.com\/smfworks\/session-timeline/);
  });

  it("summarizes counts", () => {
    assert.equal(formatCompactStats(card), "3 events · 1 user · 1 tool · 1 done");
  });
});
