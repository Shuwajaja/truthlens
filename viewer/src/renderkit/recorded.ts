import { isRecord, type Run } from "../workspace.ts";
export const rawText = (value: unknown): string =>
  typeof value === "string"
    ? value
    : (JSON.stringify(value, null, 2) ?? "No embedded content.");
export const embeddedRaster = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 2_000_000 &&
  /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value);
export function recordedEvents(run: Run) {
  return run.integrity === "failed"
    ? []
    : run.events.slice(0, 1000).map((event) => ({
        id: String(event.id),
        type: String(event.type),
        summary:
          typeof event.summary === "string"
            ? event.summary
            : String(event.type),
        timestamp: typeof event.ts === "string" ? event.ts : null,
        actor:
          isRecord(event.actor) && typeof event.actor.id === "string"
            ? event.actor.id
            : null,
        payload: event.payload,
      }));
}
export function diffLines(text: string) {
  let old: number | null = null,
    next: number | null = null;
  return text
    .split(/\r?\n/)
    .slice(0, 10000)
    .map((text) => {
      const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
      if (hunk) {
        old = Number(hunk[1]);
        next = Number(hunk[2]);
        return { text, old: null, next: null, kind: "hunk" };
      }
      if (
        text.startsWith("diff ") ||
        text.startsWith("---") ||
        text.startsWith("+++")
      )
        return { text, old: null, next: null, kind: "header" };
      const kind = text.startsWith("+")
        ? "added"
        : text.startsWith("-")
          ? "removed"
          : text.startsWith(" ")
            ? "context"
            : "metadata";
      const row = {
        text,
        old: kind === "removed" || kind === "context" ? old : null,
        next: kind === "added" || kind === "context" ? next : null,
        kind,
      };
      if (old !== null && (kind === "removed" || kind === "context")) old++;
      if (next !== null && (kind === "added" || kind === "context")) next++;
      return row;
    });
}
