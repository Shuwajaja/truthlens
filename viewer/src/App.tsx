import { useState, useEffect } from "react";
import LegacyApp from "./LegacyApp.tsx";
import { validateWorkspace, type WorkspaceDoc } from "./workspace.ts";
import { Workspace } from "./app/Workspace.tsx";
import "./workspace.css";
export default function App() {
  const [doc, setDoc] = useState<WorkspaceDoc | null>(null);
  const [documentRevision, setDocumentRevision] = useState(0);
  function replaceDocument(next: WorkspaceDoc) {
    setDoc(next);
    // Imported snapshots may share timestamps and IDs. Reset selections and
    // pending Navigator requests whenever the underlying evidence changes.
    setDocumentRevision((revision) => revision + 1);
  }
  const [legacy, setLegacy] = useState(false);
  const [error, setError] = useState("");
  const upload = (
    <label>
      Open a local workspace export
      <input
        data-testid="workspace-import"
        type="file"
        accept="application/json,.json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            if (f.size > 20_000_000) throw Error("Export exceeds size limit");
            const d: unknown = JSON.parse(await f.text());
            if (!validateWorkspace(d)) throw Error("Invalid workspace export");
            replaceDocument(d);
            setLegacy(false);
            setError("");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Import failed");
          }
        }}
      />
    </label>
  );
  useEffect(() => {
    const controller = new AbortController();
    fetch("/workspace.json", { signal: controller.signal })
      .then(async (r) => {
        if (r.status === 404) {
          setLegacy(true);
          return;
        }
        if (!r.ok) throw Error(`Workspace request failed (${r.status})`);
        const text = await r.text();
        if (text.length > 20_000_000)
          throw Error("Workspace export exceeds size limit");
        const data: unknown = JSON.parse(text);
        if (!validateWorkspace(data))
          throw Error("Invalid workspace schema. Restore a valid export.");
        setDoc(data);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, []);
  if (legacy)
    return (
      <>
        <div className="tl-load" style={{ minHeight: 0, padding: 16 }}>
          {upload}
        </div>
        <LegacyApp />
      </>
    );
  if (error)
    return (
      <main className="tl-load">
        <h1>Workspace unavailable</h1>
        <p role="alert">{error}</p>
        <p>No fallback data is displayed for an invalid workspace.</p>
        {upload}
      </main>
    );
  return doc ? (
    <Workspace key={documentRevision} doc={doc} onImport={replaceDocument} />
  ) : (
    <main className="tl-load">Loading workspace…</main>
  );
}
