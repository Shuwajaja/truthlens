import { useState } from "react";
import "./ConnectionGuide.css";

type Connection = "preview" | "codex" | "chatgpt";

// Project IDs are data, including when shown in a copyable shell command.
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

export function ConnectionGuide({ projectId }: { projectId: string }) {
  const [connection, setConnection] = useState<Connection>("preview");
  const startCommand = [
    "truthlens mcp-app",
    "  --db '/absolute/path/to/catalog.sqlite'",
    "  --widget '/absolute/path/to/viewer/dist-widget/widget.html'",
    `  --project ${shellQuote(projectId)}`,
    "  --port 4177",
  ].join(" \\\n");

  return (
    <section
      className="tl-connect-guide"
      aria-labelledby="connect-tools-heading"
    >
      <h2 id="connect-tools-heading">Connect your tools</h2>
      <p>Choose where you want to read your recorded work.</p>
      <div
        className="tl-connect-choices"
        role="group"
        aria-label="Where to connect"
      >
        {(
          [
            ["preview", "Try in your browser"],
            ["codex", "Use with Codex"],
            ["chatgpt", "Use with ChatGPT"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={connection === value}
            aria-controls="connection-instructions"
            onClick={() => setConnection(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div id="connection-instructions">
        {connection === "chatgpt" ? (
          <>
            <h3>ChatGPT needs a hosted connection</h3>
            <p>
              Your local preview is ready to try first. ChatGPT setup is a
              separate step.
            </p>
            <ol>
              <li>
                <strong>Set up your private server.</strong>
                <p>
                  It needs an HTTPS address, OAuth sign-in and permission checks
                  for each user's projects. The current local server does not
                  provide these yet.
                </p>
              </li>
              <li>
                <strong>Add it in ChatGPT.</strong>
                <p>
                  Where your account supports custom MCP servers, open Plugins →
                  + → Add custom MCP server. Enter the HTTPS address and sign
                  in. Menu names can vary.
                </p>
              </li>
              <li>
                <strong>Ask to see recorded evidence.</strong>
                <p>
                  Start a new chat and ask: “Show a recorded run and explain
                  what its evidence proves.” Check that the widget opens in your
                  ChatGPT app.
                </p>
              </li>
            </ol>
            <details>
              <summary>Another option for private testing</summary>
              <p>
                OpenAI Secure MCP Tunnel can reach a local server after its
                Platform credentials and ChatGPT workspace permissions are
                configured. A Codex subscription login does not set up this
                tunnel.
              </p>
            </details>
          </>
        ) : (
          <>
            <h3>
              {connection === "preview"
                ? "Try the widget on this computer"
                : "Give Codex read access"}
            </h3>
            <ol>
              <li>
                <strong>Start TruthLens in a terminal.</strong>
                <p>
                  Replace both example paths with your catalog and built widget.
                  The project below is your current selection.
                </p>
                <pre aria-label="Start the local TruthLens server">
                  <code>{startCommand}</code>
                </pre>
                <details>
                  <summary>First time? Prepare the local files</summary>
                  <p>
                    From the TruthLens repository, use Python 3.12+ in an
                    activated virtual environment and Node 24.
                  </p>
                  <pre>
                    <code>
                      {
                        "python -m pip install -e '.[app]'\ntruthlens catalog rebuild --config '/absolute/path/to/sources.json' --db '/absolute/path/to/catalog.sqlite'\nnpm --prefix viewer ci\nnpm --prefix viewer run build:widget"
                      }
                    </code>
                  </pre>
                  <p>
                    Use your own source configuration for sources.json. The
                    bundled demo/workspace/sources.json is available for a demo;
                    its project is truthlens. Keep this terminal open while
                    using the connection.
                  </p>
                </details>
              </li>
              {connection === "preview" ? (
                <>
                  <li>
                    <strong>Open the preview.</strong>
                    <p>
                      <a
                        href="http://127.0.0.1:4177/preview"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open local widget preview ↗
                      </a>
                    </p>
                    <p>
                      Open it on the computer running TruthLens. On a phone,
                      this address points to the phone itself.
                    </p>
                  </li>
                  <li>
                    <strong>Pick your project and a recorded run.</strong>
                    <p>
                      Open its evidence or an artifact. No AI account is needed
                      to try this preview.
                    </p>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <strong>Add the connection in a second terminal.</strong>
                    <pre aria-label="Add TruthLens to Codex">
                      <code>
                        codex mcp add truthlens-workspace --url
                        http://127.0.0.1:4177/mcp
                      </code>
                    </pre>
                  </li>
                  <li>
                    <strong>Start a new Codex session and ask:</strong>
                    <blockquote>
                      Use truthlens-workspace to show a recorded run and explain
                      what its evidence proves.
                    </blockquote>
                    <p>
                      Codex can return text and evidence even if its interface
                      does not display the widget.
                    </p>
                  </li>
                </>
              )}
            </ol>
          </>
        )}
      </div>
      <p className="tl-connect-status">
        Setup instructions only · Connection status has not been checked.
      </p>
    </section>
  );
}
