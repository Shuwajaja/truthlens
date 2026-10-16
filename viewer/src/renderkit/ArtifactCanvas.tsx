import { useState } from "react";
import { ArtifactRenderer } from "../Renderer.tsx";
import { rendererOptions, type RendererId } from "../registry.ts";
import type { Artifact, Run, WorkspaceDoc } from "../workspace.ts";
import { SourceTrust } from "./views.tsx";
import { rawText } from "./recorded.ts";
export function ArtifactCanvas({
  doc,
  run,
  artifact,
  mode = "web",
  renderer,
  compact = false,
  onOpenSource,
}: {
  doc: WorkspaceDoc;
  run: Run;
  artifact: Artifact;
  mode?: "web" | "mcp-app";
  renderer?: RendererId;
  compact?: boolean;
  onOpenSource?: (ref: string) => void;
}) {
  const [raw, setRaw] = useState(false);
  const [wrap, setWrap] = useState(true);
  const canonical = doc.runs.find(
      (r) => r.id === run.id && r.project_id === run.project_id,
    ),
    recorded = canonical?.artifacts.find((a) => a.id === artifact.id);
  if (!canonical || !recorded)
    return <p role="alert">Artifact unavailable in this workspace.</p>;
  const selected =
    renderer && rendererOptions(recorded).includes(renderer)
      ? renderer
      : rendererOptions(recorded)[0];
  return (
    <section
      className={`rk-canvas ${compact ? "rk-compact" : ""} ${wrap ? "rk-wrap" : ""}`}
    >
      <header className="rk-artifact-bar">
        <h3>{recorded.path}</h3>
        <p>
          {selected === "plain"
            ? "Source document"
            : `${selected.charAt(0).toUpperCase()}${selected.slice(1)} preview`}
        </p>
        <details className="rk-source-disclosure">
          <summary>
            Source &amp; verification{" "}
            <span>
              {canonical.origin === "IMPORTED"
                ? "Imported report"
                : "Native record"}{" "}
              · {canonical.integrity}
            </span>
          </summary>
          <SourceTrust run={canonical} doc={doc} />
        </details>
      </header>
      {canonical.integrity === "failed" ? (
        <p role="alert">
          Integrity failed. Artifact content is isolated; it cannot be presented
          as evidence.
        </p>
      ) : (
        <>
          <div className="rk-toolbar">
            <button
              type="button"
              aria-pressed={!raw}
              onClick={() => setRaw(false)}
            >
              Rendered
            </button>
            <button
              type="button"
              aria-pressed={raw}
              onClick={() => setRaw(true)}
            >
              Raw source
            </button>
            {["plain", "diff", "json"].includes(selected) && (
              <button
                type="button"
                aria-pressed={wrap}
                onClick={() => setWrap(!wrap)}
              >
                Wrap lines
              </button>
            )}
            {onOpenSource && (
              <button type="button" onClick={() => onOpenSource(recorded.id)}>
                Source details
              </button>
            )}
          </div>
          <div className="rk-stage rk-reveal" key={raw ? "raw" : selected}>
            {raw ? (
              <pre>{rawText(recorded.content)}</pre>
            ) : (
              <ArtifactRenderer
                artifact={{ ...recorded, kind: selected }}
                mode={mode}
              />
            )}
          </div>
        </>
      )}
      <details>
        <summary>Canonical reference</summary>
        <dl>
          <dt>Project</dt>
          <dd>{canonical.project_id ?? "Unassigned"}</dd>
          <dt>Run</dt>
          <dd>{canonical.id}</dd>
          <dt>Artifact</dt>
          <dd>{recorded.id}</dd>
          <dt>Source</dt>
          <dd>{canonical.source_id}</dd>
        </dl>
      </details>
    </section>
  );
}
