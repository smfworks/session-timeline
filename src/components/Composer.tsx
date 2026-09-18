import { PASTE_PLACEHOLDER, SAMPLES } from "../data/samples";
import type { MetaOverrides } from "../types";

interface ComposerProps {
  raw: string;
  sampleId: string | null;
  meta: MetaOverrides;
  onRawChange: (value: string) => void;
  onMetaChange: (next: MetaOverrides) => void;
  onSample: (id: string) => void;
}

export function Composer({
  raw,
  sampleId,
  meta,
  onRawChange,
  onMetaChange,
  onSample,
}: ComposerProps) {
  return (
    <section className="composer">
      <div className="composer-head">
        <h2>Session log</h2>
        <p>Pick a sample or paste a chat transcript, agent log, or JSON blob.</p>
      </div>

      <div className="sample-row" role="list">
        {SAMPLES.map((sample) => (
          <button
            key={sample.id}
            type="button"
            role="listitem"
            className={sampleId === sample.id ? "chip is-on" : "chip"}
            onClick={() => onSample(sample.id)}
          >
            <span className="chip-top">
              <i className="dot is-go" aria-hidden="true" />
              {sample.label}
            </span>
            <small>{sample.blurb}</small>
          </button>
        ))}
      </div>

      <label className="editor-label" htmlFor="session-input">
        Transcript or JSON
      </label>
      <textarea
        id="session-input"
        value={raw}
        onChange={(event) => onRawChange(event.target.value)}
        placeholder={PASTE_PLACEHOLDER}
        spellCheck={false}
        autoComplete="off"
      />

      <div className="meta-inputs">
        <div>
          <label className="editor-label" htmlFor="title-input">
            Title <span className="opt">(optional)</span>
          </label>
          <input
            id="title-input"
            value={meta.title ?? ""}
            onChange={(event) => onMetaChange({ ...meta, title: event.target.value })}
            placeholder="Successful PR fix"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="editor-label" htmlFor="agent-input">
            Agent <span className="opt">(optional)</span>
          </label>
          <input
            id="agent-input"
            value={meta.agent ?? ""}
            onChange={(event) => onMetaChange({ ...meta, agent: event.target.value })}
            placeholder="Cursor · Hermes · OpenClaw"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="editor-label" htmlFor="date-input">
            Date <span className="opt">(optional)</span>
          </label>
          <input
            id="date-input"
            value={meta.date ?? ""}
            onChange={(event) => onMetaChange({ ...meta, date: event.target.value })}
            placeholder="2026-09-18"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="composer-foot">
        <span>
          {raw.trim() ? `${raw.length.toLocaleString()} chars` : "Client-side only · no API"}
        </span>
      </div>

      <p className="disclaimer">
        Heuristic parser. Labels are approximate — USER / AGENT / TOOL / ERROR /
        DONE from patterns in the paste, not a real trace. Not an audit. Judgment
        stays human.
      </p>
    </section>
  );
}
