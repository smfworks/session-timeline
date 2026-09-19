import { SAMPLES } from "./data/samples";
import { parseSessionLog, slugify, timelineToJson } from "./lib/parse";
import { cardToPngBlob, copyText, downloadBlob } from "./lib/exportImage";
import type { MetaOverrides, SessionTimeline } from "./types";
import { Actions } from "./components/Actions";
import { Composer } from "./components/Composer";
import { Header } from "./components/Header";
import { SisterStrip } from "./components/SisterStrip";
import { TimelineCard } from "./components/TimelineCard";
import { Toast } from "./components/Toast";
import { formatCompactStats, formatShareText } from "./lib/share";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function applyShotClass(): void {
  const shot = new URLSearchParams(window.location.search).get("shot");
  if (shot === "card" || shot === "og") {
    document.body.classList.add(`shot-${shot}`);
  }
}

export default function App() {
  applyShotClass();
  const [raw, setRaw] = useState("");
  const [meta, setMeta] = useState<MetaOverrides>({});
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<"png" | "share" | "json" | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  const loadSample = useCallback(
    async (id: string) => {
      const sample = SAMPLES.find((item) => item.id === id);
      if (!sample) return;
      try {
        const response = await fetch(sample.file);
        if (!response.ok) throw new Error("missing sample");
        const data: unknown = await response.json();
        setRaw(JSON.stringify(data, null, 2));
        if (data && typeof data === "object") {
          const record = data as Record<string, unknown>;
          setMeta({
            title: typeof record.title === "string" ? record.title : "",
            agent: typeof record.agent === "string" ? record.agent : "",
            date: typeof record.date === "string" ? record.date : "",
          });
        }
        setSampleId(id);
      } catch {
        showToast("Could not load that sample.");
      }
    },
    [showToast],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sample = params.get("sample");
    if (sample) void loadSample(sample);
  }, [loadSample]);

  const card = useMemo(
    () => parseSessionLog(raw, meta),
    [raw, meta],
  );

  const reset = useCallback(() => {
    setRaw("");
    setMeta({});
    setSampleId(null);
    showToast("Cleared.");
  }, [showToast]);

  const withFrame = useCallback(async () => {
    const node = frameRef.current;
    if (!node || !card) throw new Error("Nothing to print yet.");
    node.classList.add("is-exporting");
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    try {
      return await cardToPngBlob(node);
    } finally {
      node.classList.remove("is-exporting");
    }
  }, [card]);

  const downloadPng = useCallback(async () => {
    if (!card) return;
    setBusy("png");
    try {
      const blob = await withFrame();
      downloadBlob(blob, `session-timeline-${slugify(card.title)}.png`);
      showToast("PNG downloaded.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "PNG export failed.");
    } finally {
      setBusy(null);
    }
  }, [card, showToast, withFrame]);

  const copyShare = useCallback(async () => {
    if (!card) return;
    setBusy("share");
    try {
      await copyText(formatShareText(card));
      showToast("Share text copied.");
    } catch {
      showToast("Could not copy share text.");
    } finally {
      setBusy(null);
    }
  }, [card, showToast]);

  const copyJson = useCallback(async () => {
    if (!card) return;
    setBusy("json");
    try {
      await copyText(timelineToJson(card));
      showToast("JSON copied.");
    } catch {
      showToast("Could not copy JSON.");
    } finally {
      setBusy(null);
    }
  }, [card, showToast]);

  const live = useMemo(() => {
    if (!card) return "Waiting for a session";
    return `${card.title} · ${card.events.length} events`;
  }, [card]);

  const preview: SessionTimeline | null = card;

  return (
    <div className="page">
      <div className="ambient" aria-hidden="true" />
      <Header />
      <SisterStrip current="session-timeline" />
      <main className="layout">
        <Composer
          raw={raw}
          sampleId={sampleId}
          meta={meta}
          onRawChange={(value) => {
            setSampleId(null);
            setRaw(value);
          }}
          onMetaChange={setMeta}
          onSample={(id) => void loadSample(id)}
        />
        <section className="stage" aria-label="Timeline preview">
          <p className="sr-only" aria-live="polite">
            {live}
          </p>
          <div className="stage-scroll">
            <div ref={frameRef} className="export-frame">
              <TimelineCard card={preview} />
            </div>
          </div>
          {card ? <p className="stage-stats">{formatCompactStats(card)}</p> : null}
          <Actions
            disabled={!card}
            busy={busy}
            onDownload={() => void downloadPng()}
            onCopyShare={() => void copyShare()}
            onCopyJson={() => void copyJson()}
            onReset={reset}
          />
        </section>
      </main>
      <footer className="site-foot">
        <p>Session Timeline · SMF Works</p>
        <p>
          Twin:{" "}
          <a href="https://github.com/smfworks/agent-receipt">Agent Receipt</a>
          {" — the stamp · "}
          <a href="https://github.com/smfworks/agent-contract">Agent Contract</a>
          {" — the bound · "}
          <a href="https://github.com/smfworks/refuse-card">Refuse Card</a>
          {" — the gate."}
        </p>
        <p>Intelligence is abundant. Judgment is the product.</p>
        <p>
          MIT · Built by{" "}
          <a href="https://smfworks.com" rel="noreferrer" target="_blank">
            SMF Works
          </a>
          {" · "}
          <a href="https://github.com/smfworks/session-timeline" rel="noreferrer" target="_blank">
            GitHub
          </a>
          {" · "}
          <a href="https://x.com/MichaelGannotti" rel="noreferrer" target="_blank">
            @MichaelGannotti
          </a>
        </p>
        <p className="fineprint">
          Heuristic demo. Not an audit log, not a compliance product, and not a
          substitute for the raw session. A shareable spine is a lab artifact.
        </p>
      </footer>
      <Toast message={toast} />
    </div>
  );
}
