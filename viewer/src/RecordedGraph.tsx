import { useState } from "react";
import { isRecord } from "./workspace.ts";
export function RecordedGraph({ data }: { data: unknown }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  if (
    !isRecord(data) ||
    !Array.isArray(data.nodes) ||
    !Array.isArray(data.edges)
  )
    return <p>Graph unavailable: recorded nodes and edges are required.</p>;
  const nodes = data.nodes
    .slice(0, 80)
    .filter((n) => isRecord(n) && typeof n.id === "string");
  const edges = data.edges.slice(0, 160).filter(isRecord);
  const position = new Map(
    nodes.map((n, i) => [
      String(n.id),
      { x: 120 + (i % 3) * 250, y: 50 + Math.floor(i / 3) * 105 },
    ]),
  );
  const valid = edges.filter(
    (e) => position.has(String(e.source)) && position.has(String(e.target)),
  );
  const chosen = nodes.find((n) => n.id === selected);
  const connected = chosen
    ? valid.filter((e) => e.source === selected || e.target === selected)
    : [];
  const height = Math.max(130, Math.ceil(nodes.length / 3) * 105);
  if (!nodes.length) return <p>No recorded graph nodes.</p>;
  return (
    <div className="tl-graph">
      <p>
        {nodes.length} of {data.nodes.length} nodes; {valid.length} of{" "}
        {data.edges.length} recorded edges shown.{" "}
        {edges.length - valid.length > 0 ? "Unknown endpoints omitted." : ""}
      </p>
      <div className="tl-graph-controls">
        <span>Select a node to trace its recorded links.</span>
        <button
          aria-label="Zoom out graph"
          disabled={zoom <= 0.6}
          onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
        >
          −
        </button>
        <button aria-label="Reset graph zoom" onClick={() => setZoom(1)}>
          {Math.round(zoom * 100)}%
        </button>
        <button
          aria-label="Zoom in graph"
          disabled={zoom >= 1.6}
          onClick={() => setZoom((z) => Math.min(1.6, z + 0.2))}
        >
          +
        </button>
        {chosen && (
          <button onClick={() => setSelected(null)}>Clear selection</button>
        )}
      </div>
      <div className="tl-scroll">
        <svg
          role="group"
          aria-label="Recorded relationships; full edge descriptions follow"
          viewBox={`0 0 750 ${height}`}
          style={{
            minWidth: 650 * zoom,
            width: `${100 * zoom}%`,
            height: height * zoom,
          }}
        >
          {valid.map((e, i) => {
            const a = position.get(String(e.source))!,
              b = position.get(String(e.target))!;
            return (
              <g
                key={i}
                className={
                  chosen
                    ? connected.includes(e)
                      ? "tl-graph-link-selected"
                      : "tl-graph-link-muted"
                    : undefined
                }
              >
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="currentColor"
                  opacity=".45"
                  pathLength="1"
                />
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 - 8}
                  fill="currentColor"
                  fontSize="11"
                >
                  {String(e.type ?? "recorded relation").slice(0, 32)}
                </text>
                <title>
                  {String(e.source)} → {String(e.target)} ·{" "}
                  {String(e.source_ref ?? "Source not recorded")} ·{" "}
                  {String(e.status ?? "UNKNOWN")}
                </title>
              </g>
            );
          })}
          {nodes.map((n) => {
            const p = position.get(String(n.id))!;
            return (
              <g
                key={String(n.id)}
                role="button"
                tabIndex={0}
                aria-label={`Inspect ${String(n.label ?? n.id)}`}
                aria-pressed={selected === n.id}
                className={
                  selected === n.id ? "tl-graph-node-selected" : "tl-graph-node"
                }
                onClick={() => setSelected(String(n.id))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(String(n.id));
                  }
                }}
              >
                <rect
                  x={p.x - 105}
                  y={p.y - 20}
                  width="210"
                  height="40"
                  rx="6"
                  fill="var(--surface)"
                  stroke="var(--border)"
                />
                <text
                  x={p.x}
                  y={p.y + 5}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="12"
                >
                  {String(n.label ?? n.id).slice(0, 29)}
                </text>
                <title>{String(n.label ?? n.id)}</title>
              </g>
            );
          })}
        </svg>
      </div>
      {chosen && (
        <section
          className="tl-graph-selection"
          aria-label="Selected recorded node"
        >
          <h3>{String(chosen.label ?? chosen.id)}</h3>
          <p>
            {connected.length} recorded connections. Selection does not create
            or infer a relationship.
          </p>
          <ul>
            {connected.map((e, i) => (
              <li key={i}>
                {String(e.type ?? "Recorded relation")} ·{" "}
                {String(
                  nodes.find(
                    (n) =>
                      n.id === (e.source === selected ? e.target : e.source),
                  )?.label ?? (e.source === selected ? e.target : e.source),
                )}
              </li>
            ))}
          </ul>
          <details>
            <summary>Source record</summary>
            <pre>{JSON.stringify(chosen, null, 2)}</pre>
          </details>
        </section>
      )}
      <details>
        <summary>Recorded nodes</summary>
        <ul>
          {nodes.map((n) => (
            <li key={String(n.id)}>
              <details>
                <summary>{String(n.label ?? n.id)}</summary>
                <pre>{JSON.stringify(n, null, 2)}</pre>
              </details>
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>Recorded relationship details</summary>
        <ul>
          {valid.map((e, i) => (
            <li key={i}>
              {String(e.source)} → {String(e.target)} · Type:{" "}
              {String(e.type ?? "Not recorded")} · Status:{" "}
              {String(e.status ?? "UNKNOWN")} · Source:{" "}
              {String(e.source_ref ?? "Not recorded")}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
