import {
  JsonView,
  defaultStyles,
  collapseAllNested,
} from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
const styles = {
  ...defaultStyles,
  container: "rk-json",
  label: "rk-json-key",
  stringValue: "rk-json-string",
  numberValue: "rk-json-number",
  booleanValue: "rk-json-number",
  nullValue: "rk-json-null",
  punctuation: "rk-json-punctuation",
  otherValue: "rk-json-key",
  expandIcon: defaultStyles.expandIcon + " rk-json-expander",
  collapseIcon: defaultStyles.collapseIcon + " rk-json-expander",
  collapsedContent: defaultStyles.collapsedContent + " rk-json-punctuation",
};
/** Only already-parsed recorded JSON; no HTML, links or model-generated components. */
export function JsonTree({ data }: { data: object }) {
  const pending: { value: unknown; depth: number }[] = [
    { value: data, depth: 0 },
  ];
  let count = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++count > 2000 || depth > 32)
      return (
        <div>
          <p>Large record · showing plain JSON to keep this view responsive.</p>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      );
    if (value && typeof value === "object") {
      const values = Object.values(value);
      if (values.length + count > 2000)
        return (
          <div>
            <p>
              Large record · showing plain JSON to keep this view responsive.
            </p>
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        );
      for (const child of values)
        pending.push({ value: child, depth: depth + 1 });
    }
  }
  return (
    <div className="rk-json-tree">
      <p className="rk-json-hint">
        Expand fields to inspect recorded values. Use arrow keys to navigate.
      </p>
      <JsonView
        data={data}
        style={styles}
        shouldExpandNode={collapseAllNested}
      />
    </div>
  );
}
