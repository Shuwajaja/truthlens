import type { Artifact, Run } from "../workspace.ts";
import { embeddedRaster } from "./recorded.ts";

export type RecordedImage = { key: string; run: Run; artifact: Artifact & { content: string } };
/** Keys reference canonical records; never accept image content from a selection. */
export function comparisonImages(runs: Run[], project: string): RecordedImage[] {
  return runs.filter((run) => run.project_id === project && run.integrity !== "failed")
    .flatMap((run) => run.artifacts.filter((artifact) => embeddedRaster(artifact.content))
      .map((artifact) => ({ key: JSON.stringify([run.id, artifact.id]), run,
        artifact: artifact as Artifact & { content: string } }))).slice(0, 200);
}
export function resolveComparison(images: RecordedImage[], first: string, second: string) {
  if (!first || !second || first === second) return null;
  const a = images.find((image) => image.key === first);
  const b = images.find((image) => image.key === second);
  return a && b && a.run.project_id === b.run.project_id ? [a, b] as const : null;
}
