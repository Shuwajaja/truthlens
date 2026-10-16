import {
  isRecord,
  type Artifact,
  type Run,
  type WorkspaceDoc,
} from "../workspace.ts";
import { recordedEvents, embeddedRaster, rawText } from "./recorded.ts";
export function SourceTrust({ run, doc }: { run: Run; doc?: WorkspaceDoc }) {
  const source = doc?.sources.find((s) => s.id === run.source_id);
  return (
    <div className="rk-provenance">
      <p>
        Source: {String(source?.name ?? run.source_id)} · Project:{" "}
        {doc?.projects.find((p) => p.id === run.project_id)?.name ??
          run.project_id ??
          "Unassigned"}
      </p>
      <dl className="rk-trust">
        {[
          ["Origin", run.origin],
          ["Integrity", run.integrity],
          ["Verification", run.verification],
          ["Review", run.review],
          ["Acceptance", run.acceptance],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
type RunProps = { run: Run; onOpenSource?: (ref: string) => void };
function SourceRef({ run, refId, onOpenSource }: RunProps & { refId: string }) {
  const event = run.events.find((e) => e.id === refId);
  const exists = Boolean(event);
  return exists && onOpenSource ? (
    <button type="button" onClick={() => onOpenSource(refId)}>
      View recorded source
    </button>
  ) : event ? (
    <details>
      <summary>Recorded source</summary>
      <code>{refId}</code>
      <pre>{rawText(event)}</pre>
    </details>
  ) : (
    <span>
      {exists ? "Recorded source" : "Source not available"}:{" "}
      <code>{refId}</code>
    </span>
  );
}
export function RunEvidence({ run, onOpenSource }: RunProps) {
  if (run.integrity === "failed")
    return <p role="alert">Integrity failed. Evidence content is isolated.</p>;
  return (
    <section className="rk-evidence">
      <h3>What was checked</h3>
      {!run.criteria.length && <p>No criteria recorded.</p>}
      {[...run.criteria]
        .sort(
          (a, b) => Number(b.status === "unmet") - Number(a.status === "unmet"),
        )
        .map((c, i) => (
          <article
            key={String(c.criterion_id ?? i)}
            className={`rk-criterion rk-${c.status}`}
          >
            <h4>Expected: {String(c.text ?? c.title)}</h4>
            <p>
              <strong>
                {c.status === "met"
                  ? "Check passed"
                  : c.status === "unmet"
                    ? "Check failed"
                    : c.status === "proposed"
                      ? "Awaiting confirmation"
                      : "Not checked"}
              </strong>{" "}

            </p>
            {Array.isArray(c.evidence) && c.evidence.length ? (
              <ul>
                {c.evidence
                  .filter((ref): ref is string => typeof ref === "string")
                  .map((ref) => {
                    const summary = run.events.find((event) => event.id === ref)?.summary;
                    return (
                      <li key={ref}>
                        <p>
                          {typeof summary === "string" && summary.trim()
                            ? <>Recorded observation: {summary}</>
                            : "Observation not included in this snapshot."}
                        </p>
                        <SourceRef
                          run={run}
                          refId={ref}
                          onOpenSource={onOpenSource}
                        />
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <p>No evidence recorded.</p>
            )}
            {run.claims
              .filter(isRecord)
              .filter(
                (claim) =>
                  Array.isArray(claim.criterion_ids) &&
                  claim.criterion_ids.includes(c.criterion_id),
              )
              .map((claim, j) => (
                <blockquote key={j}>
                  <p>Agent claimed: {String(claim.text)}</p>
                  <p>
                    {claim.finding === "supported" ? "The recorded evidence supports this claim." : claim.finding === "claim_unwitnessed" ? "The recorded evidence does not establish this claim." : "No conclusion about this claim was recorded."}
                  </p>
                </blockquote>
              ))}
            <details>
              <summary>Technical check details</summary>
              <p>Status: {String(c.status)}</p>
              {run.claims.filter(isRecord).filter((claim) => Array.isArray(claim.criterion_ids) && claim.criterion_ids.includes(c.criterion_id)).map((claim, j) => (
                <p key={j}>Claim finding: {String(claim.finding ?? "not recorded")}</p>
              ))}
            </details>
          </article>
        ))}
      {run.claims
        .filter(isRecord)
        .filter(
          (claim) =>
            !Array.isArray(claim.criterion_ids) ||
            !claim.criterion_ids.some((id) =>
              run.criteria.some((c) => c.criterion_id === id),
            ),
        )
        .map((claim, i) => (
          <blockquote key={`unlinked:${i}`}>
            <p>Agent claimed: {String(claim.text)}</p>
            <p>
              No matching criterion recorded · Claim finding:{" "}
              {String(claim.finding ?? "not recorded")}
            </p>
          </blockquote>
        ))}
      {!run.claims.length && <p>No agent claims recorded.</p>}
    </section>
  );
}
export function RunTimeline({ run, onOpenSource }: RunProps) {
  const events = recordedEvents(run);
  return (
    <section>
      <h3>Recorded timeline</h3>
      {run.integrity === "failed" ? (
        <p role="alert">Integrity failed. Event content is isolated.</p>
      ) : !events.length ? (
        <p>No events recorded.</p>
      ) : (
        <>
          <p>
            {events.length} of {run.events.length} recorded events · Original
            order; no inferred duration.
          </p>
          <ol className="rk-timeline">
            {events.map((event, i) => (
              <li key={`${event.id}:${i}`}>
                <p>
                  {event.timestamp ? (
                    <time dateTime={event.timestamp}>{event.timestamp}</time>
                  ) : (
                    "Time not recorded"
                  )}{" "}
                  · {event.type}
                </p>
                <p>{event.summary}</p>
                {event.actor && <p>Actor: {event.actor}</p>}
                <SourceRef
                  run={run}
                  refId={event.id}
                  onOpenSource={onOpenSource}
                />
                <details>
                  <summary>Recorded payload</summary>
                  <pre>{rawText(event.payload)}</pre>
                </details>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
export function RunStory({ run, onOpenSource }: RunProps) {
  const events = recordedEvents(run);
  return (
    <section>
      <h3>Recorded story</h3>
      <p>
        This account follows recorded events. It does not infer steps or
        outcomes.
      </p>
      {!events.length ? (
        <p>
          {run.integrity === "failed"
            ? "Integrity failed. Story content is isolated."
            : "No events recorded."}
        </p>
      ) : (
        <ol className="rk-story">
          {events.map((event, i) => (
            <li key={`${event.id}:${i}`}>
              <p>{event.summary}</p>
              <SourceRef
                run={run}
                refId={event.id}
                onOpenSource={onOpenSource}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
export function SearchResults({
  runs,
  onOpenRun,
}: {
  runs: Run[];
  onOpenRun?: (run: Run) => void;
}) {
  return (
    <div className="rk-results">
      {!runs.length ? (
        <p>No matching recorded results.</p>
      ) : (
        runs.map((run) => (
          <article key={run.id}>
            <h3>
              {onOpenRun ? (
                <button type="button" onClick={() => onOpenRun(run)}>
                  {run.title}
                </button>
              ) : (
                run.title
              )}
            </h3>
            <SourceTrust run={run} />
            <p>
              {run.artifacts.length} recorded artifacts · {run.criteria.length}{" "}
              criteria
            </p>
          </article>
        ))
      )}
    </div>
  );
}
export function NeedReview(props: {
  runs: Run[];
  onOpenRun?: (run: Run) => void;
}) {
  const runs = props.runs.filter(
    (run) =>
      run.review === "REQUIRED" ||
      run.verification === "FAILED" ||
      run.integrity === "failed",
  );
  return (
    <section>
      <h3>Needs review</h3>
      <p>Read-only list. Opening an item does not approve it.</p>
      {runs.length ? (
        <SearchResults {...props} runs={runs} />
      ) : (
        <p>No runs requiring review in this selection.</p>
      )}
    </section>
  );
}
export function ArtifactGallery({
  run,
  onOpenArtifact,
}: {
  run: Run;
  onOpenArtifact?: (artifact: Artifact) => void;
}) {
  if (run.integrity === "failed")
    return <p role="alert">Integrity failed. Gallery content is isolated.</p>;
  const images = run.artifacts.filter((a) => embeddedRaster(a.content));
  return (
    <section>
      <h3>Recorded images</h3>
      {!images.length ? (
        <p>No permitted embedded images recorded.</p>
      ) : (
        <div className="rk-gallery">
          {images.map((a) => (
            <figure key={a.id}>
              <img
                src={a.content as string}
                alt={`Recorded artifact: ${a.path}`}
                loading="lazy"
              />
              <figcaption>
                {onOpenArtifact ? (
                  <button type="button" onClick={() => onOpenArtifact(a)}>
                    {a.path}
                  </button>
                ) : (
                  a.path
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
