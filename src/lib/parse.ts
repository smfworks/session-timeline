import {
  EVENT_TYPES,
  MAX_EVENTS,
  MAX_PASTE,
  MAX_SUMMARY_LENGTH,
  MAX_VISIBLE_EVENTS,
  TIMELINE_SCHEMA,
  type EventType,
  type MetaOverrides,
  type SessionTimeline,
  type TimelineEvent,
} from "../types.ts";

const USER_HEAD =
  /^(?:user|human|you|operator|prompt|question|michael)\s*(?:said)?\s*[:\-–]\s*/i;
const AGENT_HEAD =
  /^(?:assistant|agent|claude|chatgpt|gpt|composer|hermes|openclaw|bot|model|aiona)\s*(?:said)?\s*[:\-–]\s*/i;
const TOOL_HEAD =
  /^(?:tool(?:\s*call)?|function(?:\s*call)?|invoke|invoked|called|using|used|ran|shell|bash|read|write|grep|strreplace|search)\s*[:\-–]?\s*/i;
const ERROR_HEAD = /^(?:error|exception|failed|failure|traceback|panic|stderr)\s*[:\-–]\s*/i;
const DONE_HEAD = /^(?:done|complete[d]?|outcome|result|shipped|finished)\s*[:\-–]\s*/i;

const TIME_ISO = /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)/;
const TIME_CLOCK = /(?:\[|\()?(\d{1,2}:\d{2}(?::\d{2})?)(?:\]|\))?/;
const DATE_ONLY = /\b(\d{4}-\d{2}-\d{2})\b/;

export function parseSessionLog(
  raw: string,
  overrides: MetaOverrides = {},
): SessionTimeline | null {
  const text = raw.trim().slice(0, MAX_PASTE);
  if (!text) return null;

  const json = tryParseJson(text);
  if (json) return normalizeTimeline(json, overrides);

  const labeled = parseLabeled(text);
  const heuristic = parseHeuristic(text);
  const merged = mergeParsed(labeled, heuristic);
  if (!merged.events.length) return null;
  return normalizeTimeline(merged, overrides);
}

export function timelineToJson(card: SessionTimeline): string {
  return `${JSON.stringify(card, null, 2)}\n`;
}

export function timelineId(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `ST-${(hash >>> 0).toString(16).toUpperCase().slice(-4).padStart(4, "0")}`;
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "session";
}

export function clipSummary(value: string, limit = MAX_SUMMARY_LENGTH): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Untitled event";
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, limit).replace(/\s+\S*$/, "").replace(/[.,;:]+$/, "")}…`;
}

export interface SpineView {
  shown: TimelineEvent[];
  overflow: number;
  total: number;
}

export function visibleSpine(events: TimelineEvent[]): SpineView {
  const total = events.length;
  if (total <= MAX_VISIBLE_EVENTS) {
    return { shown: events, overflow: 0, total };
  }
  const last = events[total - 1];
  if (last.type === "DONE") {
    const keepHead = MAX_VISIBLE_EVENTS - 2;
    const head = events.slice(0, keepHead);
    return {
      shown: [...head, last],
      overflow: total - head.length - 1,
      total,
    };
  }
  const keep = MAX_VISIBLE_EVENTS - 1;
  return {
    shown: events.slice(0, keep),
    overflow: total - keep,
    total,
  };
}

export function countByType(events: TimelineEvent[]): Record<EventType, number> {
  const counts: Record<EventType, number> = {
    USER: 0,
    AGENT: 0,
    TOOL: 0,
    ERROR: 0,
    DONE: 0,
  };
  for (const event of events) counts[event.type] += 1;
  return counts;
}

function tryParseJson(text: string): Record<string, unknown> | null {
  if (!(text.startsWith("{") || text.startsWith("["))) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) {
      if (parsed.length && parsed.every(isEventLike)) {
        return { events: parsed };
      }
      if (parsed.length === 1 && isRecord(parsed[0]) && isTimelineLike(parsed[0])) {
        return parsed[0];
      }
      return null;
    }
    if (isRecord(parsed) && isTimelineLike(parsed)) return parsed;
  } catch {
    return null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimelineLike(value: Record<string, unknown>): boolean {
  if (Array.isArray(value.events) && value.events.length > 0) return true;
  if (typeof value.transcript === "string" && value.transcript.trim()) return true;
  if (typeof value.title === "string" && value.title.trim()) return true;
  return false;
}

function isEventLike(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const type = value.type ?? value.kind ?? value.role;
  const summary = value.summary ?? value.text ?? value.message ?? value.content;
  return typeof type === "string" && typeof summary === "string";
}

function parseLabeled(text: string): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  const events: TimelineEvent[] = [];

  for (const original of text.split(/\r?\n/)) {
    const line = original.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([a-zA-Z][\w.-]*)\s*:\s*(.+)$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (!value) continue;

    if (key === "title" || key === "headline" || key === "name") {
      fields.title = value;
      continue;
    }
    if (key === "agent" || key === "model" || key === "stack") {
      fields.agent = value;
      continue;
    }
    if (key === "date" || key === "when" || key === "session") {
      fields.date = value;
      continue;
    }
    const type = typeFromLabel(key);
    if (type) {
      events.push(makeEvent(type, value, extractTime(line), events.length + 1));
    }
  }

  if (events.length) fields.events = events;
  return fields;
}

function parseHeuristic(text: string): Record<string, unknown> {
  const events: TimelineEvent[] = [];
  const fields: Record<string, unknown> = {};
  const blocks = splitBlocks(text);

  for (const block of blocks) {
    const classified = classifyBlock(block);
    if (!classified) continue;
    const previous = events[events.length - 1];
    if (
      previous &&
      previous.type === classified.type &&
      previous.type === "TOOL" &&
      previous.summary === classified.summary
    ) {
      continue;
    }
    events.push(
      makeEvent(classified.type, classified.summary, classified.at, events.length + 1),
    );
    if (events.length >= MAX_EVENTS) break;
  }

  const titleLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => isTitleCandidate(line));
  if (titleLine) fields.title = clipSummary(stripDecor(titleLine), 72);

  const agentMatch = text.match(
    /\b(?:agent|model|assistant)\s*[=:]\s*([A-Za-z0-9._:+/-]{2,40})/i,
  );
  if (agentMatch) fields.agent = agentMatch[1];

  const dateMatch = text.match(DATE_ONLY);
  if (dateMatch) fields.date = dateMatch[1];

  if (events.length) fields.events = events;
  return fields;
}

function mergeParsed(
  labeled: Record<string, unknown>,
  heuristic: Record<string, unknown>,
): Record<string, unknown> {
  const labeledEvents = Array.isArray(labeled.events) ? labeled.events : [];
  const heuristicEvents = Array.isArray(heuristic.events) ? heuristic.events : [];
  return {
    title: labeled.title || heuristic.title,
    agent: labeled.agent || heuristic.agent,
    date: labeled.date || heuristic.date,
    events: labeledEvents.length >= heuristicEvents.length ? labeledEvents : heuristicEvents,
  };
}

function splitBlocks(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    const joined = current.join("\n").trim();
    if (joined) blocks.push(joined);
    current = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (current.length && isRoleStart(trimmed)) {
      flush();
    }
    current.push(trimmed);
  }
  flush();
  return blocks;
}

function isRoleStart(line: string): boolean {
  return (
    USER_HEAD.test(line) ||
    AGENT_HEAD.test(line) ||
    TOOL_HEAD.test(line) ||
    ERROR_HEAD.test(line) ||
    DONE_HEAD.test(line) ||
    /^<(?:user|assistant|tool_call|invoke)/i.test(line) ||
    /^\[(?:tool|function|error)[:\s]/i.test(line) ||
    /^(?:you said|chatgpt said)\b/i.test(line)
  );
}

function classifyBlock(
  block: string,
): { type: EventType; summary: string; at?: string } | null {
  const first = block.split(/\n/)[0]?.trim() ?? block;
  const at = extractTime(block);
  const body = stripTime(stripDecor(block));

  if (USER_HEAD.test(first) || /^(?:you said)\b/i.test(first)) {
    return { type: "USER", summary: stripHead(body, USER_HEAD), at };
  }
  if (AGENT_HEAD.test(first) || /^(?:chatgpt said)\b/i.test(first)) {
    return { type: "AGENT", summary: stripHead(body, AGENT_HEAD), at };
  }
  if (
    ERROR_HEAD.test(first) ||
    /\b(error|exception|traceback|failed with|exit code [1-9])/i.test(first)
  ) {
    return { type: "ERROR", summary: stripHead(body, ERROR_HEAD), at };
  }
  if (
    DONE_HEAD.test(first) ||
    /\b(opened (a )?pr|pull request (is )?open|tests pass|shipped|all green|done\.)\b/i.test(
      body,
    )
  ) {
    return { type: "DONE", summary: stripHead(body, DONE_HEAD), at };
  }
  if (
    TOOL_HEAD.test(first) ||
    /^<(?:tool_call|invoke|function_call)/i.test(first) ||
    /^\[(?:tool|function)[:\s]/i.test(first) ||
    /\b(called|invoked|using)\s+(?:the\s+)?(?:tool|function|skill)\b/i.test(first)
  ) {
    return { type: "TOOL", summary: toolSummary(body), at };
  }

  if (first.length < 8) return null;
  if (/^[{[]/.test(first) && first.length < 40) return null;
  return { type: "AGENT", summary: body, at };
}

function stripHead(value: string, pattern: RegExp): string {
  return value.replace(pattern, "").replace(/^(?:you said|chatgpt said)\s*[:\-–]?\s*/i, "");
}

function toolSummary(value: string): string {
  const named =
    value.match(
      /(?:tool|function|skill|command)\s*[:=]\s*[`"'"]?([A-Za-z][\w./:-]*)/i,
    )?.[1] ||
    value.match(/name=["']([^"']+)/i)?.[1] ||
    value.match(/^tool\s+([A-Za-z][\w./:-]*)/i)?.[1];
  const cleaned = stripHead(value, TOOL_HEAD);
  if (named && cleaned.toLowerCase().startsWith(named.toLowerCase()) === false) {
    return `${named} ${cleaned}`.trim();
  }
  return cleaned || named || "tool call";
}

function extractTime(value: string): string | undefined {
  const iso = value.match(TIME_ISO)?.[1];
  if (iso) {
    const clock = iso.match(/T(\d{2}:\d{2})/)?.[1] || iso.match(/ (\d{2}:\d{2})/)?.[1];
    return clock ?? iso.slice(0, 16);
  }
  const clock = value.match(TIME_CLOCK)?.[1];
  if (clock) return clock.length === 5 || clock.length === 8 ? clock.slice(0, 5) : clock;
  return undefined;
}

function stripTime(value: string): string {
  return value
    .replace(TIME_ISO, "")
    .replace(/^[\[(]?\d{1,2}:\d{2}(?::\d{2})?[)\]]?\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDecor(value: string): string {
  return value
    .replace(/^[-*•>]+\s*/, "")
    .replace(/^`+|`+$/g, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

function isTitleCandidate(line: string): boolean {
  if (line.length < 8 || line.length > 90) return false;
  if (/[{}<>]|https?:\/\//.test(line)) return false;
  if (isRoleStart(line)) return false;
  if (/^(title|agent|date|model)\s*:/i.test(line)) return false;
  return /[a-zA-Z]/.test(line);
}

function typeFromLabel(key: string): EventType | null {
  if (["user", "human", "you", "prompt"].includes(key)) return "USER";
  if (["assistant", "agent", "bot", "claude", "gpt"].includes(key)) return "AGENT";
  if (["tool", "tools", "function", "shell", "cmd"].includes(key)) return "TOOL";
  if (["error", "err", "fail", "failed", "exception"].includes(key)) return "ERROR";
  if (["done", "complete", "outcome", "result", "shipped"].includes(key)) return "DONE";
  return null;
}

function makeEvent(
  type: EventType,
  summary: string,
  at: string | undefined,
  step: number,
): TimelineEvent {
  const event: TimelineEvent = {
    type,
    summary: clipSummary(summary),
    step,
  };
  if (at) event.at = at;
  return event;
}

function coerceType(value: unknown): EventType | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  if ((EVENT_TYPES as string[]).includes(upper)) return upper as EventType;
  const mapped = typeFromLabel(value.trim().toLowerCase());
  if (mapped) return mapped;
  if (["system", "developer"].includes(value.trim().toLowerCase())) return "AGENT";
  return null;
}

function coerceEvents(value: unknown): TimelineEvent[] {
  if (!Array.isArray(value)) return [];
  const events: TimelineEvent[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const parsed = classifyBlock(item);
      if (!parsed) continue;
      events.push(makeEvent(parsed.type, parsed.summary, parsed.at, events.length + 1));
      continue;
    }
    if (!isRecord(item)) continue;
    const type = coerceType(item.type ?? item.kind ?? item.role);
    const summaryRaw = item.summary ?? item.text ?? item.message ?? item.content ?? item.name;
    if (!type || typeof summaryRaw !== "string" || !summaryRaw.trim()) continue;
    const at =
      (typeof item.at === "string" && item.at) ||
      (typeof item.time === "string" && item.time) ||
      extractTime(summaryRaw);
    events.push(makeEvent(type, summaryRaw, at || undefined, events.length + 1));
    if (events.length >= MAX_EVENTS) break;
  }
  return events;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatDateLabel(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    }
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return value;
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function normalizeTimeline(
  input: Record<string, unknown>,
  overrides: MetaOverrides = {},
): SessionTimeline | null {
  let events = coerceEvents(input.events);
  if (!events.length && typeof input.transcript === "string") {
    const fromTranscript = parseHeuristic(input.transcript);
    events = coerceEvents(fromTranscript.events);
    if (!input.title && fromTranscript.title) input.title = fromTranscript.title;
    if (!input.agent && fromTranscript.agent) input.agent = fromTranscript.agent;
    if (!input.date && fromTranscript.date) input.date = fromTranscript.date;
  }

  const title =
    overrides.title?.trim() ||
    asString(input.title) ||
    asString(input.name) ||
    events.find((event) => event.type === "USER")?.summary ||
    events[0]?.summary ||
    "";
  if (!title && !events.length) return null;

  const agent =
    overrides.agent?.trim() ||
    asString(input.agent) ||
    asString(input.model) ||
    "Agent";

  const rawDate =
    overrides.date?.trim() ||
    asString(input.date) ||
    asString(input.issuedAt) ||
    "";
  const date = rawDate ? formatDateLabel(rawDate) : todayLabel();

  const card: SessionTimeline = {
    schema: TIMELINE_SCHEMA,
    id: asString(input.id).match(/^ST-[0-9A-F]{4}$/)
      ? asString(input.id)
      : timelineId(`${title}|${agent}|${events.map((event) => event.summary).join("|")}`),
    title: clipSummary(title || "Untitled session", 72),
    agent: clipSummary(agent, 40),
    date,
    events,
    heuristic: true,
  };

  if (!card.events.length) {
    card.events = [makeEvent("AGENT", card.title, undefined, 1)];
  }
  return card;
}
