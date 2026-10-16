import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AppBridge,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { isRecord } from "../workspace.ts";
import "./widget.css";

export function Preview() {
  const frame = useRef<HTMLIFrameElement>(null);
  const client = useRef<Client | null>(null);
  const bridge = useRef<AppBridge | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [project, setProject] = useState("");
  const [view, setView] = useState("workspace-overview");
  const [status, setStatus] = useState("Connecting to local MCP…");
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const initTimeout = useRef<number | undefined>(undefined);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    const c = new Client(
      { name: "TruthLens local preview", version: "1.1.0" },
      {
        capabilities: {
          experimental: {
            "io.modelcontextprotocol/ui": {
              mimeTypes: ["text/html;profile=mcp-app"],
            },
          },
        },
      },
    );
    client.current = c;
    let stopped = false;
    void (async () => {
      await c.connect(
        new StreamableHTTPClientTransport(new URL("/mcp", location.origin)),
      );
      const result = await c.callTool({
        name: "truthlens_list_projects",
        arguments: {},
      });
      const data = result.structuredContent;
      if (
        result.isError ||
        !isRecord(data) ||
        !Array.isArray(data.items) ||
        !data.items.every(
          (p) =>
            isRecord(p) &&
            typeof p.id === "string" &&
            typeof p.name === "string",
        )
      )
        throw new Error("Invalid projects response");
      if (!stopped) {
        setProjects(data.items as { id: string; name: string }[]);
        setProject(String(data.items[0]?.id ?? ""));
        setReady(true);
        setBusy(false);
        setStatus(
          "Connected to the local MCP server. Choose a project to inspect recorded evidence.",
        );
      }
    })().catch(() => {
      if (!stopped) {
        setBusy(false);
        setStatus(
          "Could not connect to /mcp. Start TruthLens MCP HTTP and reload this page.",
        );
      }
    });
    return () => {
      stopped = true;
      clearTimeout(initTimeout.current);
      void bridge.current?.close();
      void c.close();
    };
  }, []);
  async function load() {
    if (!client.current || !frame.current || busy || !project) return;
    setBusy(true);
    setStatus("Reading recorded runs…");
    try {
      const c = client.current;
      const found = await c.callTool({
        name: "truthlens_list_runs",
        arguments: { project_id: project, page_size: 10 },
      });
      const data = found.structuredContent;
      if (found.isError || !isRecord(data) || !Array.isArray(data.items))
        throw new Error("Cannot read runs");
      const runIds = data.items.map((r) => {
        if (!isRecord(r) || typeof r.id !== "string")
          throw new Error("Invalid run ID");
        return r.id;
      });
      if (typeof data.snapshot_id !== "string")
        throw new Error("Missing snapshot");
      let artifactId: string | undefined;
      if (view === "artifact-viewer") {
        if (!runIds[0]) throw new Error("No recorded run");
        const artifacts = await c.callTool({
          name: "truthlens_list_artifacts",
          arguments: { project_id: project, run_id: runIds[0], page_size: 1 },
        });
        const page = artifacts.structuredContent;
        if (
          artifacts.isError ||
          !isRecord(page) ||
          !Array.isArray(page.items) ||
          !isRecord(page.items[0]) ||
          typeof page.items[0].id !== "string"
        )
          throw new Error("No recorded artifact");
        artifactId = page.items[0].id;
      }
      const args = {
        project_id: project,
        view,
        ...(view !== "workspace-overview" && view !== "project-memory" && runIds[0]
          ? { run_id: runIds[0] }
          : {}),
        ...(artifactId ? { artifact_id: artifactId } : {}),
        expected_snapshot_id: data.snapshot_id,
      };
      const result = await c.callTool({
        name: "truthlens_compose_view",
        arguments: args,
      });
      if (result.isError) throw new Error("Cannot render snapshot");
      const resource = await c.readResource({
        uri: `ui://truthlens/${view}`,
      });
      const html = resource.contents.find(
        (r) => r.mimeType === "text/html;profile=mcp-app" && "text" in r,
      );
      if (!html || !("text" in html) || typeof html.text !== "string")
        throw new Error("Widget resource unavailable");
      await bridge.current?.close();
      const b = new AppBridge(
        c,
        { name: "TruthLens local preview", version: "1.0.0" },
        { serverTools: {} },
        {
          hostContext: {
            theme,
            displayMode: "inline",
            availableDisplayModes: ["inline"],
          },
        },
      );
      bridge.current = b;
      b.onsizechange = ({ height }) => {
        if (frame.current && height)
          frame.current.style.height = `${Math.min(1800, Math.max(400, height))}px`;
      };
      b.oninitialized = () => {
        clearTimeout(initTimeout.current);
        void (async () => {
          await b.sendToolInput({ arguments: args });
          await b.sendToolResult(result);
          setStatus(
            "Live local MCP result loaded. ChatGPT itself has not been tested.",
          );
          setBusy(false);
        })().catch(() => {
          setStatus("Widget initialization failed. Try loading again.");
          setBusy(false);
        });
      };
      await b.connect(
        new PostMessageTransport(
          frame.current.contentWindow!,
          frame.current.contentWindow!,
        ),
      );
      initTimeout.current = window.setTimeout(() => {
        setBusy(false);
        setStatus(
          "Widget did not initialize. Load the workspace again to retry.",
        );
        void b.close();
      }, 10000);
      frame.current.srcdoc = html.text;
    } catch {
      clearTimeout(initTimeout.current);
      setStatus(
        "Could not load this workspace. Confirm the widget is built and the selected project is accessible, then retry.",
      );
      setBusy(false);
    }
  }
  return (
    <main className="preview">
      <h1>TruthLens · local MCP host preview</h1>
      <p>
        ChatGPT is not connected. This page uses the real local MCP tools and
        the same widget resource through the official MCP Apps bridge.
      </p>
      <label htmlFor="project">Project</label>
      <select
        id="project"
        disabled={busy}
        value={project}
        onChange={(e) => {
          setProject(e.target.value);
          void bridge.current?.close();
          bridge.current = null;
          if (frame.current) frame.current.srcdoc = "";
          setStatus(
            "Project changed. Load this workspace to view its evidence.",
          );
        }}
      >
        {projects.map((p) => (
          <option value={p.id} key={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <label htmlFor="view">View</label>
      <select
        id="view"
        value={view}
        disabled={busy}
        onChange={(e) => setView(e.target.value)}
      >
        <option value="workspace-overview">Workspace overview</option>
        <option value="artifact-viewer">Artifact viewer</option>
        <option value="evidence-inspector">Evidence inspector</option>
        <option value="run-timeline">Run timeline</option>
        <option value="project-memory">Project memory</option>
      </select>
      <div className="actions">
        <button
          disabled={!ready || busy || !project}
          onClick={() => void load()}
        >
          {busy ? "Loading…" : "Load workspace"}
        </button>
        <button
          onClick={() => {
            const next = theme === "dark" ? "light" : "dark";
            setTheme(next);
            bridge.current?.setHostContext({
              theme: next,
              displayMode: "inline",
              availableDisplayModes: ["inline"],
            });
          }}
        >
          Use {theme === "dark" ? "light" : "dark"} theme
        </button>
      </div>
      <p role="status">{status}</p>
      <iframe
        ref={frame}
        title="TruthLens MCP widget"
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
