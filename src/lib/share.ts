import { countByType } from "./parse.ts";
import type { EventType, SessionTimeline, TimelineEvent } from "../types.ts";

const SHARE_URL = "https://github.com/smfworks/session-timeline";

const GLYPH: Record<EventType, string> = {
  USER: "👤",
  AGENT: "✦",
  TOOL: "⚒",
  ERROR: "✕",
  DONE: "✓",
};

export function formatShareText(card: SessionTimeline): string {
  const lines = [
    "📍 Session Timeline",
    card.title,
    `${card.agent} · ${card.date} · ${card.events.length} events`,
    "",
  ];
  for (const event of card.events.slice(0, 12)) {
    lines.push(formatEventLine(event));
  }
  if (card.events.length > 12) {
    lines.push(`+${card.events.length - 12} more`);
  }
  lines.push("", "Receipt is a stamp. Timeline is the story.");
  lines.push("Session Timeline · SMF Works", SHARE_URL);
  return lines.join("\n");
}

export function formatEventLine(event: TimelineEvent): string {
  const mark = event.at ?? String(event.step).padStart(2, "0");
  return `${mark} ${GLYPH[event.type]} ${event.type.padEnd(6, " ")} ${event.summary}`;
}

export function formatCompactStats(card: SessionTimeline): string {
  const counts = countByType(card.events);
  const bits = [
    `${card.events.length} events`,
    counts.USER ? `${counts.USER} user` : "",
    counts.TOOL ? `${counts.TOOL} tool` : "",
    counts.ERROR ? `${counts.ERROR} error` : "",
    counts.DONE ? `${counts.DONE} done` : "",
  ].filter(Boolean);
  return bits.join(" · ");
}
