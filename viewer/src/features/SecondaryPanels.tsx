import { RecordedGraph } from "../RecordedGraph.tsx";
import {
  defaultProfile,
  validateWorkspace,
  validateProfile,
  type Action,
  type Profile,
  type Run,
  type WorkspaceDoc,
} from "../workspace.ts";
import { json } from "../app/format.ts";
import type { ShellView } from "../app/tabs.ts";
type Props = {
  view: ShellView;
  d: WorkspaceDoc;
  project: string;
  runs: Run[];
  memory: WorkspaceDoc["memory"];
  developer: boolean;
  profile: Profile;
  setProfile: (profile: Profile) => void;
  act: (a: Action) => boolean;
  setNotice: (text: string) => void;
  onImport: (doc: WorkspaceDoc) => void;
  exportProfile: () => void;
};
export function SecondaryPanels({
  view,
  d,
  project,
  runs,
  memory,
  developer,
  profile,
  setProfile,
  act,
  setNotice,
  onImport,
  exportProfile,
}: Props) {
  const paneOrder = profile.pane_order;
  const collection = profile.collection;
  return (
    <>
      {view === "Knowledge" && (
        <section>
          <h2>Project memory</h2>
          <RecordedGraph
            data={{
              nodes: memory.map((m) => ({
                id: String(m.id),
                label: String(m.text),
              })),
              edges: memory
                .filter(
                  (m) =>
                    typeof m.revision_of === "string" &&
                    memory.some((other) => other.id === m.revision_of),
                )
                .map((m) => ({
                  source: String(m.revision_of),
                  target: String(m.id),
                  type: "revision_of",
                  status: "OBSERVED",
                  source_ref: String(m.source_ref),
                })),
            }}
          />
          <p>
            {memory.length} of{" "}
            {d.memory.filter((m) => m.project_id === project).length} records
            shown
          </p>
          {!memory.length && <p>No matching memory records.</p>}
          {memory.map((m) => (
            <article className="tl-memory" key={String(m.id)}>
              <p>{String(m.text)}</p>
              <dl>
                {[
                  "source_ref",
                  "captured_at",
                  "valid_from",
                  "valid_to",
                  "revision_of",
                  "claim_refs",
                  "retrieval_refs",
                  "access_policy",
                ].map((k) => (
                  <div key={k}>
                    <dt>{k.replaceAll("_", " ")}</dt>
                    <dd>{json(m[k] ?? "Not recorded")}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </section>
      )}
      {view === "Sources" && (
        <section>
          <h2>Connect a local export</h2>
          <label>
            Workspace export JSON
            <input
              data-testid="workspace-import"
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 20_000_000) {
                  setNotice("Workspace export exceeds size limit");
                  return;
                }
                try {
                  const data: unknown = JSON.parse(await f.text());
                  if (!validateWorkspace(data)) throw Error();
                  setNotice("Local export loaded. Nothing was uploaded.");
                  onImport(data);
                } catch {
                  setNotice(
                    "Invalid workspace export. Existing data unchanged.",
                  );
                }
              }}
            />
          </label>
          <p>
            Read-only import in this browser. Nothing is uploaded or persisted.
          </p>
          <h2>Recorded sources</h2>
          {!d.sources.length && <p>No sources recorded.</p>}
          {d.sources
            .filter(
              (s) =>
                runs.some((r) => r.source_id === s.id) ||
                d.memory.some(
                  (m) => m.project_id === project && m.source_id === s.id,
                ),
            )
            .map((s) => (
              <article className="tl-memory" key={String(s.id)}>
                <h3>{String(s.name)}</h3>
                <p>Kind: {String(s.kind)}</p>
                {developer && <pre>{json(s)}</pre>}
              </article>
            ))}
          <h2>Workspace mapping</h2>
          {d.workspaces
            .filter((w) => w.project_id === project)
            .map((w) => (
              <p key={w.id}>
                {w.name}: {w.mapping_reason ?? "No mapping reason recorded"}
              </p>
            ))}
          <h2>Unassigned imports</h2>
          <p>
            {d.unassigned.length} records are unassigned and excluded from
            project results.
          </p>
          {developer && <pre>{json(d.unassigned)}</pre>}
        </section>
      )}
      {view === "Appearance" && (
        <section className="tl-settings">
          <h2>Appearance profile</h2>
          <label>
            Pane order
            <select
              value={paneOrder.join(",")}
              onChange={(e) =>
                act({
                  type: "set_layout",
                  project_id: project,
                  layout: { pane_order: e.target.value.split(",") },
                })
              }
            >
              <option value="runs,results,knowledge">
                Runs → Results → Knowledge
              </option>
              <option value="results,runs,knowledge">
                Results → Runs → Knowledge
              </option>
              <option value="knowledge,results,runs">
                Knowledge → Results → Runs
              </option>
            </select>
          </label>
          <label>
            Collection
            <select
              value={collection}
              onChange={(e) =>
                act({
                  type: "set_layout",
                  project_id: project,
                  layout: {
                    collection: e.target.value as "cards" | "list",
                  },
                })
              }
            >
              <option>list</option>
              <option>cards</option>
            </select>
          </label>
          {(
            [
              ["theme", ["dark", "light"]],
              ["density", ["comfortable", "compact"]],
              ["accent", ["green", "blue", "purple"]],
              ["pane", ["results-first", "activity-first"]],
            ] as const
          ).map(([key, opts]) => (
            <label key={key}>
              {key}
              <select
                aria-label={key}
                value={profile[key]}
                onChange={(e) => {
                  const next = { ...profile, [key]: e.target.value };
                  if (validateProfile(next)) setProfile(next);
                }}
              >
                {opts.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          ))}
          <button onClick={() => setProfile(defaultProfile)}>
            Reset profile
          </button>
          <button onClick={exportProfile}>Export profile</button>
          <label>
            Import profile
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 10000) {
                  setNotice("Profile too large");
                  return;
                }
                try {
                  const p: unknown = JSON.parse(await f.text());
                  if (!validateProfile(p)) throw Error();
                  setProfile(p);
                  setNotice("Profile imported");
                } catch {
                  setNotice("Invalid profile. No settings changed.");
                }
              }}
            />
          </label>
          <p>
            Stored locally. Status colors remain independent of your accent.
          </p>
        </section>
      )}
    </>
  );
}
