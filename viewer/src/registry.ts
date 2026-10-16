import type { Artifact } from "./workspace.ts";
export type RendererId =
  | "markdown"
  | "plain"
  | "diff"
  | "json"
  | "table"
  | "chart"
  | "timeline"
  | "graph"
  | "html"
  | "media";
export const registry = (
  [
    ["markdown", ["markdown", "md"], 80, "react-text"],
    ["diff", ["diff", "patch"], 90, "react-text"],
    ["json", ["json"], 70, "react-text"],
    ["table", ["table", "csv"], 60, "react-text"],
    ["chart", ["chart"], 60, "react-text"],
    ["timeline", ["timeline"], 60, "react-text"],
    ["graph", ["graph"], 60, "recorded-edges-only"],
    ["html", ["html"], 50, "opaque-origin-no-network"],
    [
      "media",
      ["media", "image", "audio", "video", "pdf"],
      40,
      "embedded-raster-only",
    ],
    ["plain", ["plain", "text", "code"], 0, "react-text"],
  ] as const
).map(([id, accepts, priority, sandbox_policy]) => ({
  id,
  version: "1",
  accepts: accepts as readonly string[],
  accepted_kinds: accepts as readonly string[],
  input_schema: `truthlens.renderer.${id}/1`,
  minimum_capabilities: id === "html" ? ["opaque-iframe"] : ["react-text"],
  limits: { content_chars: 2_000_000, rows: 1000, columns: 100, points: 500 },
  accessibility: "keyboard-source-and-raw; text-status; bounded-scroll-region",
  surfaces: id === "html" ? ["web"] : ["web", "mcp-app"],
  requires: ["content"],
  trust_display: "separate-origin-integrity-check-review-acceptance",
  priority,
  fallback: "plain",
  sandbox_policy,
  theme_tokens: ["background", "surface", "text", "muted"],
}));
export function rendererFor(kind: string): RendererId {
  return (
    registry
      .filter((r) => r.accepts.includes(kind.toLowerCase()))
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0]
      ?.id ?? "plain"
  );
}
export function rendererOptions(a: Artifact): RendererId[] {
  const native = a.content === undefined ? "plain" : rendererFor(a.kind);
  return native === "plain" ? ["plain"] : [native, "plain"];
}
// Both surfaces share this catalog; higher-level run views do not invent artifact kinds.
export const renderers = registry;
