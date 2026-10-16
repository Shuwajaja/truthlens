import { isRecord } from "../workspace.ts";
import "./recorded-timeline.css";

function scalar(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() ? value : undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function field(entry: unknown, keys: string[]): string | undefined {
  if (!isRecord(entry)) return undefined;
  for (const key of keys) {
    const value = scalar(entry[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Recorded order is authoritative: no timestamp sorting or inferred outcomes. */
export function RecordedTimeline({ entries }: { entries: unknown[] }) {
  const shown = entries.slice(0, 1000);
  return (
    <section className="rk-timeline" aria-label="Recorded timeline">
      <p className="rk-timeline-caption">
        {shown.length} of {entries.length} entries shown · In recorded order
      </p>
      {shown.length === 0 ? <p>No timeline entries recorded.</p> : (
        <ol className="rk-timeline-list">
          {shown.map((entry, index) => {
            const title = field(entry, ["title", "label", "type", "event"]);
            const description = field(entry, ["description", "summary", "message"]);
            const timestamp = field(entry, ["timestamp", "ts", "time"]);
            return (
              <li className="rk-timeline-item" key={index}>
                <span className="rk-timeline-marker" aria-hidden="true">{index + 1}</span>
                <div className="rk-timeline-body">
                  <strong className="rk-timeline-heading">{title ?? `Entry ${index + 1}`}</strong>
                  {timestamp !== undefined && <p className="rk-timeline-time">Recorded time: {timestamp}</p>}
                  {description !== undefined && <p className="rk-timeline-description">{description}</p>}
                  {!isRecord(entry) && <p className="rk-timeline-description">{scalar(entry) ?? (entry === null ? "null" : "See recorded details for this entry.")}</p>}
                  <details className="rk-timeline-details">
                    <summary>Recorded details</summary>
                    <pre>{JSON.stringify(entry, null, 2) ?? "No recorded value."}</pre>
                  </details>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
