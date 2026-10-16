import type { ReactNode } from "react";
import {
  ArrowUpRight,
  CircleAlert,
  FileText,
  Plug,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { Artifact, Run } from "../workspace.ts";
import { stamp } from "../app/format.ts";
type Props = {
  memoryCount: number;
  onKnowledge: () => void;
  paneOrder: string[];
  activity: ReactNode | null;
  runs: Run[];
  total: number;
  artifacts: { run: Run; artifact: Artifact }[];
  onRun: (run: Run) => void;
  onArtifact: (run: Run, artifact: Artifact) => void;
  onConnect: () => void;
  onResults: () => void;
};
export function Overview({
  memoryCount,
  onKnowledge,
  paneOrder,
  activity,
  runs,
  total,
  artifacts,
  onRun,
  onArtifact,
  onConnect,
  onResults,
}: Props) {
  const priority =
    runs.find((r) => r.integrity === "failed") ??
    runs.find((r) => r.verification === "FAILED");
  const unmet = priority?.criteria.filter((c) => c.status === "unmet") ?? [];
  return (
    <div className="tl-review-home">
      <section className="tl-review-focus" aria-labelledby="review-next">
        <div className="tl-review-lead">
          <ShieldCheck size={24} aria-hidden="true" />
          <h2 id="review-next">
            {priority ? "Start with this run" : "Choose a run to review"}
          </h2>
          <span>Human review stays yours</span>
        </div>
        {priority ? (
          <>
            <div className="tl-review-verdict">
              <CircleAlert size={22} aria-hidden="true" />
              <div>
                <h3>
                  {priority.integrity === "failed"
                    ? "The record failed its integrity check."
                    : `${unmet.length || "Recorded"} ${unmet.length === 1 ? "check needs" : "checks need"} attention.`}
                </h3>
                <p>
                  {priority.integrity === "failed"
                    ? "Its contents are isolated. Open the diagnostic before using this record."
                    : String(
                        unmet[0]?.text ??
                          unmet[0]?.title ??
                          "This run contains a recorded failed check. Inspect its evidence before accepting the result.",
                      )}
                </p>
              </div>
            </div>
            <p className="tl-review-task">{priority.title}</p>
            <button
              className="tl-primary-action"
              onClick={() => onRun(priority)}
            >
              Review this run <ArrowRight size={18} aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <p>
              {runs.length
                ? "Read what was claimed, see what was checked, then open the source. Unknown checks remain unknown."
                : "No runs in this selection. Connect a recorded export to begin."}
            </p>
            <button
              className="tl-primary-action"
              onClick={() => (runs[0] ? onRun(runs[0]) : onConnect())}
            >
              {runs.length ? "Open the first run" : "Connect a source"}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </>
        )}
      </section>
      <div style={{ order: paneOrder.indexOf("runs") }}>
        {activity ?? (
          <section className="tl-work-register" aria-labelledby="recorded-work">
            <div className="tl-register-heading">
              <h2 id="recorded-work">Recorded work</h2>
              <span>
                {runs.length} of {total} runs
              </span>
            </div>
            <p className="tl-register-caption">
              A run is one recorded piece of work by an agent. Open it to
              compare the result with its evidence.
            </p>
            <div className="tl-register-columns" aria-hidden="true">
              <span>Work & source</span>
              <span>Recorded checks</span>
              <span>Outputs</span>
              <span />
            </div>
            {!runs.length && (
              <p>
                No matching runs. Clear your search or choose another workspace.
              </p>
            )}
            {runs.map((run) => (
              <button
                className="tl-register-row"
                key={run.id}
                onClick={() => onRun(run)}
              >
                <span className="tl-register-work">
                  <strong>{run.title}</strong>
                  <span>
                    {run.origin === "IMPORTED"
                      ? "Imported report"
                      : "Native recording"}{" "}
                    · {stamp(run.started)}
                  </span>
                </span>
                <span
                  className={`tl-check-label ${run.integrity === "failed" || run.verification === "FAILED" ? "tl-check-failed" : ""}`}
                >
                  {run.integrity === "failed"
                    ? "Integrity failed"
                    : run.verification === "FAILED"
                      ? "Failed checks"
                      : run.verification === "VERIFIED"
                        ? "Checks verified"
                        : "Not verified"}
                </span>
                <span className="tl-register-count">
                  {run.integrity === "failed"
                    ? "Isolated"
                    : `${run.artifacts.length} files`}
                </span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </button>
            ))}
          </section>
        )}
      </div>
      <section
        style={{ order: paneOrder.indexOf("results") }}
        className="tl-output-shelf"
        aria-labelledby="recorded-outputs"
      >
        <div className="tl-register-heading">
          <h2 id="recorded-outputs">Open a result</h2>
          <button onClick={onResults}>
            All {artifacts.length} files{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="tl-output-items">
          {artifacts.slice(0, 3).map(({ run, artifact }) => (
            <button key={artifact.id} onClick={() => onArtifact(run, artifact)}>
              <FileText size={22} aria-hidden="true" />
              <span>
                <strong>{artifact.path.split("/").at(-1)}</strong>
                <span>{artifact.kind} · Recorded file</span>
              </span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
        {!artifacts.length && <p>No readable artifacts in this selection.</p>}
      </section>
      {memoryCount > 0 && (
        <section
          className="tl-output-shelf"
          style={{ order: paneOrder.indexOf("knowledge") }}
        >
          <div className="tl-register-heading">
            <h2>Project memory</h2>
            <button onClick={onKnowledge}>
              Open {memoryCount} recorded notes{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}
      <section className="tl-connect-entry">
        <Plug size={24} aria-hidden="true" />
        <div>
          <h2>Bring your tools into the picture</h2>
          <p>
            Read a local export or use TruthLens from an MCP-compatible client.
          </p>
        </div>
        <button onClick={onConnect}>
          Connect your tools <ArrowRight size={16} aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
