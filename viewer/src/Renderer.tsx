import { MarkdownView } from "./components/MarkdownView.tsx";
import { RecordedDiff } from "./renderkit/RecordedDiff.tsx";
import { isRecord, type Artifact } from "./workspace.ts";
import { RecordedGraph } from "./RecordedGraph.tsx";
import { rendererFor } from "./registry.ts";
import DOMPurify from "dompurify";
const show = (v: unknown) =>
  typeof v === "string"
    ? v
    : (JSON.stringify(v, null, 2) ?? "No embedded content.");
export function ArtifactRenderer({
  artifact: a,
  mode = "web",
}: {
  artifact: Artifact;
  mode?: "web" | "mcp-app";
}) {
  const kind = a.content === undefined ? "plain" : rendererFor(a.kind),
    text = show(a.content);
  let data: unknown = a.content;
  if (
    typeof data === "string" &&
    ["json", "table", "chart", "timeline", "graph"].includes(kind)
  ) {
    try {
      data = JSON.parse(data);
    } catch {
      return (
        <div role="alert">
          Invalid {kind} content. <pre>{text}</pre>
        </div>
      );
    }
  }
  if (kind === "markdown") return <MarkdownView text={text} />;
  if (kind === "diff") return <RecordedDiff text={text} />;
  if (kind === "html" && mode === "mcp-app")
    return (
      <div>
        <p>HTML source · interactive HTML is isolated from this host.</p>
        <pre>{text}</pre>
      </div>
    );
  if (kind === "html")
    return (
      <iframe
        title="Isolated HTML preview"
        sandbox=""
        referrerPolicy="no-referrer"
        srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'">${DOMPurify.sanitize(
          text,
          {
            USE_PROFILES: { html: true },
            FORBID_TAGS: [
              "meta",
              "base",
              "link",
              "iframe",
              "object",
              "embed",
              "form",
              "input",
              "button",
            ],
            FORBID_ATTR: [
              "href",
              "src",
              "srcset",
              "action",
              "formaction",
              "poster",
              "xlink:href",
            ],
          },
        )}`}
      />
    );
  if (kind === "media") {
    const src = typeof a.content === "string" ? a.content : "";
    // Only embedded raster formats: SVG, remote URLs and paths never execute or fetch.
    if (/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(src))
      return (
        <figure>
          <img
            src={src}
            alt={`Recorded artifact: ${a.path}`}
            style={{ maxWidth: "100%" }}
          />
          <figcaption>Embedded image · {a.path}</figcaption>
        </figure>
      );
    return (
      <div>
        <p>
          Media unavailable: only embedded raster images can be previewed.
          Remote URLs, SVG and unverified file paths are never loaded
          automatically.
        </p>
        <pre>{text}</pre>
      </div>
    );
  }
  if (
    kind === "table" &&
    isRecord(data) &&
    Array.isArray(data.columns) &&
    Array.isArray(data.rows)
  )
    return (
      <div className="tl-scroll">
        <table>
          <caption>
            {Math.min(data.rows.length, 1000)} of {data.rows.length} rows ·{" "}
            {Math.min(data.columns.length, 100)} of {data.columns.length}{" "}
            columns shown
          </caption>
          <thead>
            <tr>
              {data.columns.slice(0, 100).map((x, i) => (
                <th scope="col" key={i}>
                  {show(x)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.slice(0, 1000).map((row, i) => (
              <tr key={i}>
                {(Array.isArray(row) ? row : [row])
                  .slice(0, 100)
                  .map((x, j) => (
                    <td key={j}>{show(x)}</td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  if (kind === "chart" && isRecord(data) && Array.isArray(data.points)) {
    const points = data.points
      .slice(0, 500)
      .filter(
        (point): point is Record<string, unknown> & { value: number } =>
          isRecord(point) &&
          typeof point.value === "number" &&
          Number.isFinite(point.value),
      );
    if (!points.length) return <p>No finite chart values recorded.</p>;
    const values = points.map((point) => point.value);
    const minimum = Math.min(0, ...values),
      maximum = Math.max(1, ...values);
    return (
      <div aria-label="Recorded chart values">
        <p>
          {points.length} of {data.points.length} recorded values shown · Unit:{" "}
          {typeof data.unit === "string" ? data.unit : "not recorded"} · Period:{" "}
          {typeof data.period === "string" ? data.period : "not recorded"}
        </p>
        {points.map((p, i) => (
          <div className="tl-chart-row" key={i}>
            <span>{String(p.label ?? i)}</span>
            <meter
              min={minimum}
              max={maximum}
              value={p.value}
              aria-label={`${String(p.label ?? i)}: ${p.value}`}
            />
            <span>{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "timeline" && Array.isArray(data))
    return (
      <ol>
        {data.slice(0, 1000).map((x, i) => (
          <li key={i}>
            <pre>{show(x)}</pre>
          </li>
        ))}
      </ol>
    );
  if (kind === "graph") return <RecordedGraph data={data} />;
  return <pre>{text}</pre>;
}
