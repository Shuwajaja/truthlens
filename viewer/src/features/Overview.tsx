import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  CircleAlert,
  CheckCircle2,
  CircleDashed,
  ChevronRight,
  FileText,
  Plug,
} from "lucide-react";
import type { Artifact, Run } from "../workspace.ts";
import { stamp } from "../app/format.ts";
import { ArtifactRenderer } from "../Renderer.tsx";
import "./overview-studio.css";

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
const identity = (run: Run) =>
  JSON.stringify([run.project_id, run.workspace_id, run.id]);
const fileName = (artifact: Artifact) =>
  artifact.path.split("/").at(-1) || artifact.path;
const previewKinds = [
  "html",
  "markdown",
  "md",
  "media",
  "image",
  "table",
  "chart",
];

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
  const [selection, setSelection] = useState("");
  const [fileSelection, setFileSelection] = useState<{
    work: string;
    file: string;
  } | null>(null);
  const priority =
    runs.find((run) => run.integrity === "failed") ??
    runs.find((run) => run.verification === "FAILED") ??
    runs[0];
  // Resolve every selection against the currently visible scope, never retained data.
  const selected = runs.find((run) => identity(run) === selection) ?? priority;
  const isolated = selected?.integrity === "failed";
  const files = selected && !isolated ? selected.artifacts : [];
  const selectedFile =
    files.find(
      (file) =>
        fileSelection?.work === identity(selected!) &&
        file.id === fileSelection.file,
    ) ??
    files.find(
      (file) =>
        previewKinds.includes(file.kind.toLowerCase()) &&
        file.content !== undefined,
    ) ??
    files[0];
  const failed =
    selected?.criteria.filter((criterion) => criterion.status === "unmet") ??
    [];
  const passed =
    selected?.criteria.filter((criterion) => criterion.status === "met")
      .length ?? 0;
  const other = (selected?.criteria.length ?? 0) - failed.length - passed;
  const needsAttention =
    isolated || failed.length > 0 || selected?.verification === "FAILED";

  return (
    <div className="tl-result-studio">

      {runs.length > 0 ? (
        <div className="studio-desk">
          <section
            className="studio-work-picker"
            aria-label="Choose work to explore"
          >
            <div className="studio-section-heading">
              <h3>Work library</h3>
              <span>
                {runs.length} of {total}
              </span>
            </div>
            <div className="studio-work-list" aria-label="Recorded work">
              {runs.map((run) => {
                const active = selected && identity(run) === identity(selected);
                const failedCount = run.criteria.filter((criterion) => criterion.status === "unmet").length;
                const unchecked = run.criteria.some((criterion) => criterion.status !== "met" && criterion.status !== "unmet");
                const status = run.integrity === "failed" ? "Record needs inspection" : failedCount > 0 ? `${failedCount} ${failedCount === 1 ? "check needs" : "checks need"} attention` : run.verification === "FAILED" ? "Checks need attention" : unchecked || !run.criteria.length ? "Checks incomplete" : "Recorded checks passed";
                const hasIssue = run.integrity === "failed" || failedCount > 0 || run.verification === "FAILED";
                const StatusIcon = hasIssue ? CircleAlert : unchecked || !run.criteria.length ? CircleDashed : CheckCircle2;
                return (
                  <button
                    key={identity(run)}
                    className={`studio-work-row${active ? " is-selected" : ""}`}
                    aria-pressed={Boolean(active)}
                    onClick={() => setSelection(identity(run))}
                  >
                    <span className="studio-work-row-top"><FileText size={16} aria-hidden="true" /><span>{run.origin === "IMPORTED" ? "Imported report" : "Recorded work"}</span><ChevronRight size={15} aria-hidden="true" /></span>
                    <strong>{run.title}</strong>
                    <span className="studio-work-date">{stamp(run.started).replace(/:\d{2}\.\d{3} UTC$/, " UTC")}</span>
                    <span className={`studio-work-status${hasIssue ? " has-issue" : ""}`}><StatusIcon size={14} aria-hidden="true" />{status}</span>
                  </button>
                );
              })}
            </div>
            <select
              className="studio-mobile-picker"
              aria-label="Choose your work"
              value={selected ? identity(selected) : ""}
              onChange={(event) => setSelection(event.target.value)}
            >
              {runs.map((run) => (
                <option key={identity(run)} value={identity(run)}>
                  {run.title} · {stamp(run.started)}{run.verification === "FAILED" ? " · Open checks" : ""}
                </option>
              ))}
            </select>

          </section>
          {selected && (
            <section className="studio-workspace" aria-label="Selected work">
              <div className="studio-result" data-testid="studio-result">
                <header className="studio-result-heading">
                  <div>
                    <h3>{selected.title}</h3>
                    <p>
                      {selected.origin === "IMPORTED"
                        ? "Imported report"
                        : "Recorded work"}
                      {selected.started ? ` · ${stamp(selected.started)}` : ""}
                    </p>
                  </div>
                  <span className="studio-file-count">
                    {isolated
                      ? "Content withheld"
                      : `${files.length} ${files.length === 1 ? "file" : "files"}`}
                  </span>
                </header>
                {!isolated && needsAttention && (
                  <button className="studio-attention-link" onClick={() => onRun(selected)}>
                    <CircleAlert size={17} aria-hidden="true" />
                    {failed.length ? `${failed.length} ${failed.length === 1 ? "check failed" : "checks failed"}` : "A check failed"} · See what needs attention
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                )}
                {isolated ? (
                  <div className="studio-empty">
                    <CircleAlert size={28} aria-hidden="true" />
                    <h4>This result needs a closer look.</h4>
                    <p>
                      The record did not pass its integrity check. Its content
                      is withheld until you inspect the problem.
                    </p>
                    <button onClick={() => onRun(selected)}>
                      Inspect the record{" "}
                      <ArrowRight size={18} aria-hidden="true" />
                    </button>
                  </div>
                ) : selectedFile ? (
                  <>
                    <div className="studio-preview-bar">
                      <label htmlFor="studio-result-file">Preview</label>
                      <select
                        id="studio-result-file"
                        value={selectedFile.id}
                        onChange={(event) =>
                          setFileSelection({
                            work: identity(selected),
                            file: event.target.value,
                          })
                        }
                      >
                        {files.map((file) => (
                          <option key={file.id} value={file.id}>
                            {fileName(file)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => onArtifact(selected, selectedFile)}
                        aria-label={`Open ${fileName(selectedFile)}`}
                      >
                        <ArrowUpRight size={20} aria-hidden="true" />
                      </button>
                    </div>
                    <div
                      className="studio-preview"
                      key={`${identity(selected)}:${selectedFile.id}`}
                      role="region"
                      aria-label={`Preview of ${fileName(selectedFile)}`}
                      tabIndex={0}
                    >
                      <ArtifactRenderer artifact={selectedFile} />
                    </div>
                    <footer className="studio-preview-footer">
                      <span>Recorded output · preview is not an approval</span>
                      <button
                        onClick={() => onArtifact(selected, selectedFile)}
                      >
                        Open result <ArrowRight size={17} aria-hidden="true" />
                      </button>
                    </footer>
                  </>
                ) : (
                  <div className="studio-empty">
                    <FileText size={28} aria-hidden="true" />
                    <h4>No result files were recorded.</h4>
                    <p>You can still explore the checks and recorded work.</p>
                    <button onClick={() => onRun(selected)}>
                      Explore this work{" "}
                      <ArrowRight size={18} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
              <aside
                className="tl-review-focus studio-review"
                aria-labelledby="studio-review-title"
              >
                <div className="studio-review-eyebrow">Before you use this result</div>
                <div className="studio-review-symbol" aria-hidden="true">
                  {needsAttention ? (
                    <CircleAlert size={26} />
                  ) : (
                    <FileText size={26} />
                  )}
                </div>
                <h3 id="studio-review-title">
                  {isolated
                    ? "Check the record first."
                    : needsAttention
                      ? `${failed.length || "Some"} ${failed.length === 1 ? "check needs" : "checks need"} attention.`
                      : "Your checks, explained."}
                </h3>
                <p>
                  {isolated
                    ? "This record cannot be relied on. Open the details before using its results."
                    : needsAttention
                      ? "Open the checks to understand what needs your attention before accepting this work."
                      : "Review the recorded checks before deciding whether the result meets your needs."}
                </p>
                {!isolated && (
                  <dl className="studio-check-counts">
                    <div>
                      <dt><CheckCircle2 size={15} aria-hidden="true" />Passed checks</dt>
                      <dd>{passed}</dd>
                    </div>
                    <div>
                      <dt><CircleAlert size={15} aria-hidden="true" />Failed checks</dt>
                      <dd>{failed.length}</dd>
                    </div>
                    <div>
                      <dt><CircleDashed size={15} aria-hidden="true" />Not confirmed</dt>
                      <dd>{other}</dd>
                    </div>
                  </dl>
                )}
                {!isolated && failed[0] && (
                  <div className="studio-expected">
                    <strong>Expected</strong>
                    <p>
                      {String(
                        failed[0].text ??
                          failed[0].title ??
                          "A recorded requirement has not been met.",
                      )}
                    </p>
                    <span>This check failed.</span>
                  </div>
                )}
                <button
                  className="studio-review-action"
                  data-testid="review-open-points"
                  onClick={() => onRun(selected)}
                >
                  {isolated
                    ? "Inspect the record"
                    : needsAttention
                      ? "Review open points"
                      : "Review this work"}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
                <p className="studio-review-note">
                  Opening a result never approves it.
                </p>
              </aside>
            </section>
          )}
        </div>
      ) : (
        <section className="studio-empty">
          <FileText size={32} aria-hidden="true" />
          <h3>
            {total
              ? "No work matches this view."
              : "Bring your first result into view."}
          </h3>
          <p>
            {total
              ? "Clear your search or choose another project to see its work."
              : "Connect your tools or open an existing report to explore what was created and checked."}
          </p>
          <button onClick={onConnect}>
            Connect your tools <ArrowRight size={18} aria-hidden="true" />
          </button>
        </section>
      )}

      <div className="studio-secondary">
        {activity && (
          <section
            style={{ order: paneOrder.indexOf("runs") }}
            aria-label="Recorded activity"
          >
            {activity}
          </section>
        )}
        <section
          className="studio-library"
          style={{ order: paneOrder.indexOf("results") }}
        >
          <div className="studio-section-heading">
            <h3>More to explore</h3>
            <button onClick={onResults}>
              All {artifacts.length} files{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="studio-library-list">
            {artifacts
              .filter(({ run }) => run.integrity !== "failed")
              .slice(0, 3)
              .map(({ run, artifact }) => (
                <button
                  key={`${identity(run)}:${artifact.id}`}
                  onClick={() => onArtifact(run, artifact)}
                >
                  <FileText size={22} aria-hidden="true" />
                  <span>
                    <strong>{fileName(artifact)}</strong>
                    <span>{run.title}</span>
                  </span>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </button>
              ))}
          </div>
          {!artifacts.length && <p>No recorded result files in this view.</p>}
        </section>
        {memoryCount > 0 && (
          <section
            className="studio-memory"
            style={{ order: paneOrder.indexOf("knowledge") }}
          >
            <h3>Project notes</h3>
            <button onClick={onKnowledge}>
              Read {memoryCount} saved notes{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </section>
        )}
      </div>
      <section className="studio-connect">
        <Plug size={22} aria-hidden="true" />
        <div>
          <h3>Bring your tools along.</h3>
          <p>
            Open a report from your computer, or explore the setup guides.
          </p>
        </div>
        <button onClick={onConnect}>
          Connect your tools <ArrowRight size={17} aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
