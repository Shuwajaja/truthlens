import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  CircleAlert,
  CheckCircle2,
  CircleDashed,
  FileText,
  Layers,
  Plus,
} from "lucide-react";
import type { Artifact, Run } from "../workspace.ts";
import { stamp } from "../app/format.ts";
import { ArtifactRenderer } from "../Renderer.tsx";
import "./truth-feed.css";
import "../design/mycompany-foundation.css";

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
const perspectives = ["Result", "Checks", "Open points"];

export function Overview({
  memoryCount,
  onKnowledge,
  runs,
  total,
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
  const [perspective, setPerspective] = useState({ work: "", page: 0 });
  const carousel = useRef<HTMLDivElement>(null);
  const priority =
    runs.find((run) => run.integrity === "failed") ??
    runs.find((run) => run.verification === "FAILED") ??
    runs[0];
  const selected = runs.find((run) => identity(run) === selection) ?? priority;
  const selectedKey = selected ? identity(selected) : "";
  const page = perspective.work === selectedKey ? perspective.page : 0;
  if (perspective.work !== selectedKey) {
    setPerspective({ work: selectedKey, page: 0 });
  }
  const setPage = (next: number) =>
    setPerspective({ work: selectedKey, page: next });
  useEffect(() => {
    carousel.current?.scrollTo({ left: 0, behavior: "instant" });
  }, [selectedKey]);
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
    selected?.criteria.filter((item) => item.status === "unmet") ?? [];
  const passed =
    selected?.criteria.filter((item) => item.status === "met").length ?? 0;
  const other = (selected?.criteria.length ?? 0) - failed.length - passed;
  const needsAttention =
    isolated || failed.length > 0 || selected?.verification === "FAILED";
  const selectedIndex = selected ? runs.indexOf(selected) : 0;
  function goToPage(index: number) {
    const node = carousel.current;
    if (!node) return;
    node.scrollTo({
      left: node.clientWidth * index,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  function choose(run: Run) {
    setSelection(identity(run));
    setPage(0);
    carousel.current?.scrollTo({ left: 0, behavior: "instant" });
  }
  return (
    <div className="truth-feed">
      <header className="feed-intro">
        <div>
          <h2>See the whole story.</h2>
        </div>
        <button onClick={onConnect} className="feed-add">
          <Plus size={18} /> Add work
        </button>
      </header>
      {selected ? (
        <>
          <nav className="feed-stories" aria-label="Choose work to explore">
            {runs.map((run, index) => (
              <button
                key={identity(run)}
                className={`feed-story${identity(run) === identity(selected) ? " is-selected" : ""}`}
                aria-pressed={identity(run) === identity(selected)}
                onClick={() => choose(run)}
                title={`${run.title} · ${stamp(run.started)}`}
              >
                <span className="feed-story-orbit">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </span>
                <strong>{run.title}</strong>
                <small title={stamp(run.started)}>
                  {stamp(run.started) === "Not recorded"
                    ? "Undated"
                    : `${stamp(run.started).slice(5, 10)} · ${stamp(run.started).slice(11, 16)} UTC`}
                </small>
              </button>
            ))}
          </nav>
          <article className="feed-post" aria-label="Selected work">
            <header className="feed-post-heading">
              <span className="feed-avatar" aria-hidden="true">
                <Layers size={21} />
              </span>
              <div>
                <h3>{selected.title}</h3>
                <p>
                  {selected.origin === "IMPORTED"
                    ? "Imported report"
                    : "Recorded work"}{" "}
                  · {stamp(selected.started)}
                </p>
              </div>
              <span className="feed-position">
                {selectedIndex + 1} / {runs.length}
              </span>
            </header>
            {!isolated && needsAttention && (
              <button
                className="feed-early-attention"
                onClick={() => onRun(selected)}
              >
                <CircleAlert size={15} aria-hidden="true" />
                {failed.length
                  ? `${failed.length} ${failed.length === 1 ? "check failed" : "checks failed"}`
                  : "Verification failed"}{" "}
                · Review open points
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            )}
            {isolated ? (
              <div className="feed-isolated">
                <CircleAlert size={32} />
                <h3>Check the record first.</h3>
                <p>
                  This record did not pass its integrity check. Its content is
                  withheld until the problem is inspected.
                </p>
              </div>
            ) : (
              <>
                <nav
                  className="feed-perspectives"
                  aria-label="Perspectives on this work"
                >
                  {perspectives.map((label, index) => (
                    <button
                      key={label}
                      aria-pressed={page === index}
                      onClick={() => goToPage(index)}
                    >
                      <span>0{index + 1}</span>
                      {label}
                    </button>
                  ))}
                </nav>
                <div
                  className="feed-carousel"
                  ref={carousel}
                  onScroll={(event) => {
                    const element = event.currentTarget;
                    setPage(
                      Math.round(element.scrollLeft / element.clientWidth),
                    );
                  }}
                  aria-label="Swipe between result, checks and open points"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (
                      event.key === "ArrowRight" ||
                      event.key === "ArrowLeft"
                    ) {
                      event.preventDefault();
                      goToPage(
                        Math.max(
                          0,
                          Math.min(
                            2,
                            page + (event.key === "ArrowRight" ? 1 : -1),
                          ),
                        ),
                      );
                    }
                  }}
                >
                  <section
                    className="feed-slide feed-result"
                    aria-label="Result"
                    inert={page !== 0}
                  >
                    <div className="feed-swipe-hint">
                      Swipe for checks and open points{" "}
                      <ArrowRight size={13} aria-hidden="true" />
                    </div>
                    {selectedFile ? (
                      <>
                        <div className="feed-file-picker">
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
                            aria-label={`Open ${fileName(selectedFile)}`}
                            onClick={() => onArtifact(selected, selectedFile)}
                          >
                            Open <ArrowUpRight size={17} aria-hidden="true" />
                          </button>
                        </div>
                        <div
                          className="studio-preview feed-preview"
                          role="region"
                          aria-label={`Preview of ${fileName(selectedFile)}`}
                          tabIndex={0}
                          key={`${identity(selected)}:${selectedFile.id}`}
                        >
                          <ArtifactRenderer artifact={selectedFile} />
                        </div>
                      </>
                    ) : (
                      <div className="feed-slide-message">
                        <FileText size={32} />
                        <h4>No preview was recorded.</h4>
                        <p>
                          The checks and open points are still available. Swipe
                          to explore them.
                        </p>
                      </div>
                    )}
                  </section>
                  <section
                    className="feed-slide feed-checks"
                    aria-label="Checks"
                    inert={page !== 1}
                  >
                    <span className="feed-kicker">THE RECORDED CHECKS</span>
                    <h4>What holds up?</h4>
                    <div className="feed-check-totals">
                      <span>
                        <CheckCircle2 size={20} />
                        <b>{passed}</b> Passed
                      </span>
                      <span>
                        <CircleAlert size={20} />
                        <b>{failed.length}</b> Failed
                      </span>
                      <span>
                        <CircleDashed size={20} />
                        <b>{other}</b> Unconfirmed
                      </span>
                    </div>
                    <ul className="feed-criteria">
                      {selected.criteria.map((criterion, index) => (
                        <li key={index}>
                          <span
                            className={`feed-check-icon ${criterion.status === "unmet" ? "is-failed" : ""}`}
                          >
                            {criterion.status === "met" ? (
                              <CheckCircle2 size={18} />
                            ) : criterion.status === "unmet" ? (
                              <CircleAlert size={18} />
                            ) : (
                              <CircleDashed size={18} />
                            )}
                          </span>
                          <div>
                            <strong>
                              {String(
                                criterion.text ??
                                  criterion.title ??
                                  "Recorded requirement",
                              )}
                            </strong>
                            <small>
                              {criterion.status === "met"
                                ? "This check passed."
                                : criterion.status === "unmet"
                                  ? "This check failed."
                                  : "This requirement is not confirmed."}
                            </small>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {!selected.criteria.length && (
                      <p>No individual checks were recorded.</p>
                    )}
                  </section>
                  <section
                    className="feed-slide feed-open"
                    aria-label="Open points"
                    inert={page !== 2}
                  >
                    <span className="feed-kicker">BEFORE YOU USE IT</span>
                    <h4>
                      {needsAttention
                        ? "Worth a closer look."
                        : other || !selected.criteria.length
                          ? "There’s more to check."
                          : "Your decision comes next."}
                    </h4>
                    {failed.map((criterion, index) => (
                      <div className="feed-open-point" key={index}>
                        <small>Expected requirement</small>
                        <p>
                          {String(
                            criterion.text ??
                              criterion.title ??
                              "A recorded requirement was not met.",
                          )}
                        </p>
                        <span>
                          <CircleAlert size={16} /> This check failed.
                        </span>
                      </div>
                    ))}
                    {!failed.length && (
                      <p>
                        {selected.verification === "FAILED"
                          ? "The overall verification failed. Open the recorded source for the available details."
                          : other || !selected.criteria.length
                            ? "Some checks are missing or not confirmed. A preview cannot fill those gaps."
                            : "The recorded checks passed. That does not establish human acceptance or prove every aspect of this result."}
                      </p>
                    )}
                  </section>
                </div>
                <div className="feed-swipe-controls">
                  <button
                    aria-label="Previous perspective"
                    disabled={page === 0}
                    onClick={() => goToPage(page - 1)}
                  >
                    <ArrowLeft size={17} />
                  </button>
                  <div
                    className="feed-dots"
                    aria-label={`Perspective ${page + 1} of 3`}
                  >
                    {perspectives.map((label, index) => (
                      <button
                        key={label}
                        aria-label={`Show ${label}`}
                        aria-pressed={page === index}
                        onClick={() => goToPage(index)}
                      >
                        <span />
                      </button>
                    ))}
                  </div>
                  <button
                    aria-label="Next perspective"
                    disabled={page === 2}
                    onClick={() => goToPage(page + 1)}
                  >
                    <ArrowRight size={17} />
                  </button>
                </div>
              </>
            )}
            <footer className="tl-review-focus feed-caption">
              <div>
                <strong>
                  {isolated
                    ? "Content withheld"
                    : needsAttention
                      ? `${failed.length || "Some"} ${failed.length === 1 ? "check needs" : "checks need"} attention`
                      : "Recorded output · your review comes next"}
                </strong>
                <p>
                  {isolated
                    ? "Inspect the source before using this work."
                    : `${passed} passed · ${failed.length} failed · ${other} unconfirmed. Preview is not approval.`}
                </p>
              </div>
              <button
                data-testid="review-open-points"
                onClick={() => onRun(selected)}
              >
                {isolated
                  ? "Inspect record"
                  : needsAttention
                    ? "Review open points"
                    : "Review this work"}
                <ArrowUpRight size={18} />
              </button>
            </footer>
          </article>
          <nav
            className="feed-work-navigation"
            aria-label="Browse recorded work"
          >
            <button
              disabled={selectedIndex === 0}
              onClick={() => choose(runs[selectedIndex - 1])}
            >
              <ArrowLeft size={18} /> Previous work
            </button>
            <span>
              {selectedIndex + 1} of {runs.length}
            </span>
            <button
              disabled={selectedIndex === runs.length - 1}
              onClick={() => choose(runs[selectedIndex + 1])}
            >
              Next work <ArrowRight size={18} />
            </button>
          </nav>
        </>
      ) : (
        <section className="feed-empty">
          <FileText size={32} />
          <h3>
            {total
              ? "No work matches this view."
              : "Your first story starts here."}
          </h3>
          <p>
            {total
              ? "Clear your search or choose another project."
              : "Open a report to explore what was created, what was checked and what remains open."}
          </p>
          <button onClick={onConnect}>
            Add your work <ArrowRight size={18} />
          </button>
        </section>
      )}
      <footer className="feed-bottom">
        <button onClick={onResults}>
          Explore all results <ArrowRight size={16} />
        </button>
        {memoryCount > 0 && (
          <button onClick={onKnowledge}>{memoryCount} project notes</button>
        )}
        <button onClick={onConnect}>Connect your tools</button>
      </footer>
    </div>
  );
}
