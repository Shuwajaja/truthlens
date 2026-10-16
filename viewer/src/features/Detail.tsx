import { useEffect, useRef, useState } from "react";
import type { Run, Artifact } from "../workspace.ts";
import { SourceTrust, RunEvidence, RunTimeline } from "../renderkit/index.ts";
import { json, stamp } from "../app/format.ts";
export function Detail({
  run,
  artifact,
  sourceRef,
  onClose,
}: {
  run: Run;
  artifact?: Artifact;
  sourceRef?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"Summary" | "Source" | "Timeline">(
    sourceRef ? "Source" : "Summary",
  );
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  const sourceRecord = sourceRef
    ? (run.events.find((e) => e.id === sourceRef) ??
      run.artifacts.find((a) => a.id === sourceRef))
    : undefined;
  return (
    <dialog
      ref={ref}
      className="tl-evidence-inspector"
      aria-label="Evidence inspector"
      onCancel={onClose}
    >
      <div className="tl-section-heading">
        <h2>Evidence inspector</h2>
        <button onClick={onClose} aria-label="Close inspector">
          Close · Esc
        </button>
      </div>
      <p className="tl-muted">{artifact?.path ?? run.title}</p>
      <div
        className="tl-inspector-tabs"
        role="tablist"
        aria-label="Inspector sections"
        onKeyDown={(e) => {
          const names = ["Summary", "Source", "Timeline"] as const;
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const next =
              names[
                (names.indexOf(tab) + (e.key === "ArrowRight" ? 1 : 2)) % 3
              ];
            setTab(next);
            requestAnimationFrame(() =>
              document.getElementById("inspector-" + next)?.focus(),
            );
          }
        }}
      >
        {(["Summary", "Source", "Timeline"] as const).map((t) => (
          <button
            role="tab"
            id={"inspector-" + t}
            aria-controls="inspector-panel"
            aria-selected={t === tab}
            tabIndex={t === tab ? 0 : -1}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div
        id="inspector-panel"
        role="tabpanel"
        aria-labelledby={"inspector-" + tab}
      >
        {tab === "Summary" && (
          <>
            <SourceTrust run={run} />
            <p>Recorded {stamp(run.started)}</p>
            <p>Assignment: {run.mapping_reason ?? "Not recorded"}</p>
            {run.integrity === "failed" ? (
              <p role="alert">
                Integrity failed. Recorded contents are isolated.
              </p>
            ) : (
              <RunEvidence run={run} />
            )}
          </>
        )}
        {tab === "Source" && (
          <>
            <h3>Original reference</h3>
            <dl>
              <dt>Source</dt>
              <dd>{run.source_id}</dd>
              <dt>Run reference</dt>
              <dd>{run.id}</dd>
              {artifact && (
                <>
                  <dt>Artifact reference</dt>
                  <dd>{artifact.id}</dd>
                </>
              )}
            </dl>
            <h3>Raw source record</h3>
            <pre tabIndex={0}>
              {json(
                run.integrity === "failed"
                  ? { id: run.id, integrity: run.integrity, errors: run.errors }
                  : (sourceRecord ?? artifact ?? run),
              )}
            </pre>
            <p>
              Exported record. This browser does not authenticate ledger
              signatures.
            </p>
          </>
        )}
        {tab === "Timeline" && <RunTimeline run={run} />}
      </div>
    </dialog>
  );
}
