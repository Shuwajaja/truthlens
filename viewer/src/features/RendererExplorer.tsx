import { useState } from "react";
import { ArtifactRenderer } from "../Renderer.tsx";
import { registry, type RendererId } from "../registry.ts";
import "./renderer-explorer.css";

const examples: { id: RendererId; label: string; question: string; content: unknown }[] = [
  { id: "markdown", label: "Document", question: "What was created?", content: "# A clearer welcome page\n\nA short introduction helps visitors find their next step.\n\n## Changes in this example\n\n- A single, clear headline\n- Readable text on mobile\n- A visible contact option\n\nThis is a fictional document to demonstrate the renderer." },
  { id: "diff", label: "Changes", question: "What changed?", content: "--- a/welcome.txt\n+++ b/welcome.txt\n@@ -1,3 +1,3 @@\n Welcome\n-Explore our comprehensive solutions.\n-Submit an inquiry.\n+Find the right help for your project.\n+Talk to us." },
  { id: "timeline", label: "Journey", question: "How did the work unfold?", content: [
    { title: "Request recorded", description: "Make the welcome page easier to read.", timestamp: "2026-10-16T09:00:00Z" },
    { title: "Draft created", description: "A shorter introduction and contact section were saved.", timestamp: "2026-10-16T09:04:00Z" },
    { title: "Review still open", description: "No human acceptance is recorded in this fictional example.", timestamp: "2026-10-16T09:07:00Z" }
  ] },
  { id: "chart", label: "Numbers", question: "How do the recorded values compare?", content: { unit: "seconds", period: "Fictional comparison", points: [{ label: "First draft", value: 12 }, { label: "Second draft", value: 8 }, { label: "Third draft", value: 6 }] } },
  { id: "table", label: "Table", question: "What are the individual details?", content: { columns: ["Page", "Recorded observation", "Next step"], rows: [["Welcome", "Draft saved", "Review wording"], ["Contact", "No check recorded", "Check the form"], ["About", "No result recorded", "Open the task"]] } },
];

export function RendererExplorer() {
  const [selected, setSelected] = useState(0);
  const example = examples[selected];
  return <section className="renderer-explorer" aria-label="Renderer examples">
    
    <nav aria-label="Choose a renderer example">{examples.map((item, index) => <button key={item.id} aria-pressed={index === selected} onClick={() => setSelected(index)}>{item.label}</button>)}</nav>
    <section className="renderer-example" aria-label={example.question}>
      <div className="renderer-example-heading"><h3>{example.question}</h3><span>Fictional example</span></div>
      <ArtifactRenderer key={example.id} artifact={{ id: "renderer-example", path: "Example", kind: example.id, content: example.content }} />
    </section>
    <p className="renderer-example-note">These examples explain the views. They are not workspace records, evidence or verification results.</p>
    <details><summary>All supported formats · technical details</summary><ul>{registry.map((item) => <li key={item.id}><strong>{item.id}</strong><span>{item.surfaces.join(" · ")} · fallback: {item.fallback}</span></li>)}</ul></details>
  </section>;
}
