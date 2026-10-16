/** Initial diagram subset: text-only flowcharts, no config, URLs, HTML, CSS or image shapes.
 * Mermaid measures SVG in the parent DOM; only this closed syntax may reach it.
 */
export function allowedDiagram(source: string): boolean {
  if (source.length > 10000) return false;
  const lines = source.trim().split(/\r?\n/);
  if (!/^(?:flowchart|graph) (?:TD|TB|BT|LR|RL)\s*;?$/.test(lines[0])) return false;
  return lines.slice(1).every(line => /^[\p{L}\p{N}\s_\-[\]().;>|]*$/u.test(line)
    && !/^\s*(?:click|style|classDef|class|linkStyle|subgraph|end)\b/i.test(line));
}
