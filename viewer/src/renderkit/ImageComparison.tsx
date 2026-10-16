import { useId, useState } from "react";
import type { Run } from "../workspace.ts";
import { comparisonImages, resolveComparison, type RecordedImage } from "./comparison.ts";
import "./ImageComparison.css";

function ImagePanel({ image, label }: { image: RecordedImage; label: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return <figure className="tl-comparison-image">
    <figcaption><strong>{label}</strong><span>{image.artifact.path}</span></figcaption>
    {failedSource === image.artifact.content ? <p role="status">This recorded image could not be decoded.</p> :
      <img src={image.artifact.content} alt={`${label}: ${image.artifact.path}`} onError={() => setFailedSource(image.artifact.content)} />}
    <p>{image.run.title}</p>
    <details><summary>Recorded source</summary><dl>
      <dt>Run</dt><dd>{image.run.id}</dd>
      <dt>Source</dt><dd>{image.run.source_id}</dd>
      <dt>Origin</dt><dd>{image.run.origin}</dd>
      <dt>Integrity</dt><dd>{image.run.integrity}</dd>
      <dt>Artifact</dt><dd>{image.artifact.id}</dd>
      {image.artifact.sha256 && <><dt>Recorded digest</dt><dd>{image.artifact.sha256}</dd></>}
    </dl></details>
  </figure>;
}

export function ImageComparison({ runs, project }: { runs: Run[]; project: string }) {
  const id = useId();
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const images = comparisonImages(runs, project);
  const pair = resolveComparison(images, first, second);
  if (!images.length) return null;
  return <details className="tl-image-comparison">
    <summary>Compare recorded images</summary>
    <p>Choose two images to inspect side by side. Selection order does not establish before and after, or prove an improvement.</p>
    {images.length < 2 ? <p>Add another recorded image to this selection to compare.</p> : <>
      <div className="tl-comparison-selectors">
        {([['First image', first, setFirst, second], ['Second image', second, setSecond, first]] as const).map(([label, value, set, other]) =>
          <div key={label}><label htmlFor={`${id}-${label}`}>{label}</label><select id={`${id}-${label}`} value={images.some((image) => image.key === value) ? value : ""} onChange={(e) => set(e.target.value)}>
            <option value="">Choose an image…</option>
            {images.map((image) => <option key={image.key} value={image.key} disabled={image.key === other}>
              {image.artifact.path} · {image.run.title} · {image.run.id}
            </option>)}
          </select></div>)}
      </div>
      <p role="status">{pair ? 'Two recorded images selected. Original proportions are preserved.' : 'Select two different images from the current results.'}</p>
      {pair && <div className="tl-comparison-pair">
        <ImagePanel key={pair[0].key} image={pair[0]} label="First image" />
        <ImagePanel key={pair[1].key} image={pair[1]} label="Second image" />
      </div>}
    </>}
  </details>;
}
