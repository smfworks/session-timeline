import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  parseSessionLog,
  timelineId,
  visibleSpine,
  clipSummary,
} from "./parse.ts";

const sampleDir = join(fileURLToPath(new URL(".", import.meta.url)), "../../public/samples");

function loadSample(id: string): string {
  return readFileSync(join(sampleDir, `${id}.json`), "utf8");
}

describe("parseSessionLog", () => {
  it("returns null for empty paste", () => {
    assert.equal(parseSessionLog("   "), null);
  });

  it("splits a chat transcript into USER / AGENT / TOOL / ERROR / DONE", () => {
    const card = parseSessionLog(`
User: Fix the failing CI on main
Assistant: I'll inspect the check, then patch.
[tool] gh run view --log
Error: TypeError: Cannot read properties of undefined
tool: StrReplace src/lib/parse.ts
Done: PR opened. Tests green.
`);
    assert.ok(card);
    assert.deepEqual(
      card.events.map((event) => event.type),
      ["USER", "AGENT", "TOOL", "ERROR", "TOOL", "DONE"],
    );
    assert.match(card.events[0].summary, /Fix the failing CI/);
    assert.equal(card.heuristic, true);
    assert.match(card.id, /^ST-[0-9A-F]{4}$/);
  });

  it("reads JSON events and optional meta", () => {
    const card = parseSessionLog(
      JSON.stringify({
        title: "Inbox triage",
        agent: "OpenClaw",
        date: "2026-09-18",
        events: [
          { type: "USER", summary: "Triage the inbox. Draft only." },
          { type: "TOOL", summary: "list_messages" },
          { type: "DONE", summary: "Three drafts waiting in the composer" },
        ],
      }),
    );
    assert.equal(card?.title, "Inbox triage");
    assert.equal(card?.agent, "OpenClaw");
    assert.equal(card?.events.length, 3);
    assert.equal(card?.events[1].type, "TOOL");
  });

  it("applies title / agent / date overrides", () => {
    const card = parseSessionLog("User: Ship the fix\nDone: PR open", {
      title: "Named run",
      agent: "Hermes",
      date: "2026-01-02",
    });
    assert.equal(card?.title, "Named run");
    assert.equal(card?.agent, "Hermes");
    assert.match(card?.date ?? "", /Jan 2026/);
  });

  it("ingests the shipped samples", () => {
    for (const id of [
      "successful-pr-fix",
      "research-then-summarize",
      "failed-deploy-retry",
      "tool-heavy-debug",
    ]) {
      const card = parseSessionLog(loadSample(id));
      assert.ok(card, id);
      assert.ok(card.events.length >= 6, id);
      assert.equal(card.events[0].type, "USER", id);
      assert.equal(card.events.at(-1)?.type, "DONE", id);
    }
  });

  it("parses labeled title/agent without turning agent into an event", () => {
    const card = parseSessionLog(`
title: Successful PR fix
agent: Cursor
date: 2026-09-18
USER: Fix CI
DONE: Shipped
`);
    assert.equal(card?.title, "Successful PR fix");
    assert.equal(card?.agent, "Cursor");
    assert.equal(card?.events.length, 2);
    assert.equal(card?.events[0].type, "USER");
  });

  it("does not treat personal names as speaker roles", () => {
    const card = parseSessionLog(`
Michael: this is a person, not a role
Aiona: also a person
User: real prompt
Assistant: working
Done: shipped
`);
    assert.ok(card);
    const users = card.events.filter((event) => event.type === "USER");
    assert.equal(users.length, 1);
    assert.match(users[0].summary, /real prompt/);
  });
});

describe("visibleSpine", () => {
  it("keeps the last DONE when collapsing overflow", () => {
    const events = Array.from({ length: 16 }, (_, index) => ({
      type: index === 15 ? ("DONE" as const) : ("TOOL" as const),
      summary: `step ${index + 1}`,
      step: index + 1,
    }));
    const spine = visibleSpine(events);
    assert.equal(spine.shown.length, 11);
    assert.equal(spine.overflow, 5);
    assert.equal(spine.shown.at(-1)?.type, "DONE");
    assert.equal(spine.total, 16);
  });

  it("passes through short timelines", () => {
    const spine = visibleSpine([
      { type: "USER", summary: "Go", step: 1 },
      { type: "DONE", summary: "Done", step: 2 },
    ]);
    assert.equal(spine.overflow, 0);
    assert.equal(spine.shown.length, 2);
  });
});

describe("helpers", () => {
  it("builds a stable ST id", () => {
    assert.equal(timelineId("same"), timelineId("same"));
    assert.notEqual(timelineId("same"), timelineId("other"));
    assert.match(timelineId("same"), /^ST-[0-9A-F]{4}$/);
  });

  it("clips summaries without mid-word cuts", () => {
    const long =
      "Inspecting the failing GitHub check and then also rewriting the entire parser for reasons that should be clipped";
    const summary = clipSummary(long);
    assert.ok(summary.endsWith("…"));
    assert.ok(summary.length < long.length);
    assert.equal(summary.includes("clipped"), false);
  });
});
