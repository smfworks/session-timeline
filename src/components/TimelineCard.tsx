import { visibleSpine } from "../lib/parse";
import type { EventType, SessionTimeline, TimelineEvent } from "../types";

interface TimelineCardProps {
  card: SessionTimeline | null;
}

function stepLabel(event: TimelineEvent): string {
  return event.at || String(event.step).padStart(2, "0");
}

export function TimelineCard({ card }: TimelineCardProps) {
  const empty = !card;
  const spine = card ? visibleSpine(card.events) : { shown: [], overflow: 0, total: 0 };
  const lastShown = spine.shown.at(-1);
  const pinDone = Boolean(spine.overflow > 0 && lastShown && lastShown.type === "DONE");
  const head = pinDone ? spine.shown.slice(0, -1) : spine.shown;
  const tail = pinDone && lastShown ? lastShown : null;

  return (
    <article className={empty ? "ticket is-empty" : "ticket"}>
      <span className="ticket-rail" aria-hidden="true" />
      <header className="ticket-head">
        <div>
          <p className="r-kicker">SMF Works</p>
          <h2>Timeline</h2>
        </div>
        <p className="ticket-seq">{card?.id ?? "ST-0000"}</p>
      </header>

      <div className="perf" aria-hidden="true">
        <span />
      </div>

      <div className="ticket-body">
        <p className="r-label">Session</p>
        <h3 className="timeline-title">
          {card?.title ?? "Waiting for a session"}
        </h3>
        <p className="timeline-meta">
          {card
            ? `${card.agent} · ${card.date} · ${card.events.length} event${card.events.length === 1 ? "" : "s"}`
            : "Paste a log or pick a sample to print a shareable spine."}
        </p>

        <ol className="spine">
          {head.length ? (
            head.map((event, index) => (
              <EventRow
                key={`${event.step}-${event.type}-${index}`}
                event={event}
                last={spine.overflow === 0 && index === head.length - 1}
              />
            ))
          ) : (
            <li className="spine-item is-empty is-last">
              <span className="spine-dot" aria-hidden="true" />
              <div className="event-chip">
                <span className="event-badge">READY</span>
                <span className="event-when">—</span>
                <p className="event-summary">No events yet</p>
              </div>
            </li>
          )}
          {spine.overflow > 0 ? (
            <li className={`spine-item is-overflow${tail ? "" : " is-last"}`}>
              <span className="spine-dot" aria-hidden="true" />
              <div className="event-chip">
                <span className="event-badge">MORE</span>
                <p className="event-summary">+{spine.overflow} more</p>
              </div>
            </li>
          ) : null}
          {tail ? <EventRow key={`tail-${tail.step}`} event={tail} last /> : null}
        </ol>
      </div>

      <footer className="r-foot">
        <p>Session Timeline · SMF Works</p>
        <p className="r-link">smfworks.com</p>
        <p className="r-motto">Receipt is a stamp. Timeline is the story.</p>
      </footer>
    </article>
  );
}

function EventRow({ event, last }: { event: TimelineEvent; last: boolean }) {
  const type = event.type.toLowerCase() as Lowercase<EventType>;
  return (
    <li className={`spine-item is-${type}${last ? " is-last" : ""}`}>
      <span className="spine-dot" aria-hidden="true" />
      <div className="event-chip">
        <span className="event-badge">{event.type}</span>
        <span className="event-when">{stepLabel(event)}</span>
        <p className="event-summary">{event.summary}</p>
      </div>
    </li>
  );
}
