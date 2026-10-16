import { diffLines } from "./recorded.ts";
export function RecordedDiff({ text }: { text: string }) {
  const lines = diffLines(text);
  return (
    <div
      className="tl-scroll"
      role="region"
      aria-label="Recorded code diff"
      tabIndex={0}
    >
      {text.split(/\r?\n/).length > lines.length && (
        <p>
          First {lines.length} lines shown. Raw source retains the complete
          diff.
        </p>
      )}
      <table className="rk-diff">
        <thead>
          <tr>
            <th scope="col">Old</th>
            <th scope="col">New</th>
            <th scope="col">Recorded change</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className={`rk-diff-${line.kind}`}>
              <td>{line.old}</td>
              <td>{line.next}</td>
              <td>
                <code>{line.text || " "}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
