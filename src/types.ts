export type EventType = "USER" | "AGENT" | "TOOL" | "ERROR" | "DONE";

export interface TimelineEvent {
  type: EventType;
  summary: string;
  at?: string;
  step: number;
}

export interface MetaOverrides {
  title?: string;
  agent?: string;
  date?: string;
}

export interface SessionTimeline {
  schema: "smf.session-timeline.v1";
  id: string;
  title: string;
  agent: string;
  date: string;
  events: TimelineEvent[];
  heuristic: true;
}

export interface SampleMeta {
  id: string;
  file: string;
  label: string;
  blurb: string;
}

export const TIMELINE_SCHEMA = "smf.session-timeline.v1" as const;
export const MAX_VISIBLE_EVENTS = 12;
export const MAX_SUMMARY_LENGTH = 88;
export const MAX_EVENTS = 80;
export const MAX_PASTE = 80_000;

export const EVENT_TYPES: EventType[] = ["USER", "AGENT", "TOOL", "ERROR", "DONE"];
