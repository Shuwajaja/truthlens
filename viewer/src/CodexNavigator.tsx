import { useEffect, useRef, useState } from "react";
import {
  isRecord,
  validAction,
  type Action,
  type WorkspaceDoc,
} from "./workspace.ts";
type Answer = { message: string; source_ids: string[]; actions: Action[] };
export function CodexNavigator({
  doc,
  project,
  onAction,
  onSource,
}: {
  doc: WorkspaceDoc;
  project: string;
  onAction: (a: Action) => boolean;
  onSource: (id: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const token = useRef("");
  const request = useRef<AbortController | null>(null);
  const active = useRef(false);
  useEffect(
    () => () => {
      request.current?.abort();
      if (active.current && token.current)
        void fetch("/api/navigator/cancel", {
          method: "POST",
          headers: { "X-TruthLens-Token": token.current },
        }).catch(() => {});
      active.current = false;
    },
    [],
  );
  function stop() {
    request.current?.abort();
    if (active.current && token.current)
      void fetch("/api/navigator/cancel", {
        method: "POST",
        headers: { "X-TruthLens-Token": token.current },
      }).catch(() => {});
    active.current = false;
    setBusy(false);
    setStatus("Stopped. No proposed action was applied.");
    setAnswer(null);
  }
  async function ask() {
    if (!question.trim() || busy) return;
    const controller = new AbortController();
    request.current = controller;
    active.current = true;
    setBusy(true);
    setStatus("Connecting to your local Codex CLI…");
    setAnswer(null);
    try {
      if (!token.current) {
        const session = await fetch("/api/session", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!session.ok)
          throw Error(
            "Codex mode needs the local TruthLens server. Local search remains available.",
          );
        const s: unknown = await session.json();
        if (
          !isRecord(s) ||
          typeof s.token !== "string" ||
          s.token.length > 1024 ||
          s.provider !== "codex-cli" ||
          s.read_only !== true
        )
          throw Error(
            "Codex session unavailable. Use the local TruthLens server or local search.",
          );
        token.current = s.token;
      }
      setStatus("Asking Codex CLI. Presentation proposals only…");
      const response = await fetch("/api/navigator", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-TruthLens-Token": token.current,
        },
        body: JSON.stringify({
          question: question.trim(),
          project_id: project,
        }),
      });
      // A restarted local server rotates its session token. Refresh on the
      // next explicit Ask, without automatically repeating a paid request.
      if (response.status === 403) token.current = "";
      const raw = await response.text();
      if (raw.length > 65536)
        throw Error("Codex response exceeded the display limit.");
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        throw Error(
          "Codex mode is unavailable on this server. Local search remains available.",
        );
      }
      if (!response.ok)
        throw Error(
          isRecord(value) && typeof value.error === "string"
            ? value.error.slice(0, 500)
            : `Codex request failed (${response.status}).`,
        );
      const ids = new Set([
        ...doc.runs.filter((r) => r.project_id === project).map((r) => r.id),
        ...doc.memory
          .filter((m) => m.project_id === project)
          .map((m) => String(m.id)),
      ]);
      if (
        !isRecord(value) ||
        typeof value.message !== "string" ||
        value.message.length > 8192 ||
        !Array.isArray(value.source_ids) ||
        value.source_ids.length > 100 ||
        !value.source_ids.every(
          (id) => typeof id === "string" && ids.has(id),
        ) ||
        !Array.isArray(value.actions) ||
        value.actions.length > 10 ||
        !value.actions.every((a) => validAction(a, doc, project)) ||
        value.search_mode !== "codex-cli" ||
        value.client_acknowledged !== false
      )
        throw Error(
          "Codex response rejected: invalid sources, scope or presentation actions. Nothing was applied.",
        );
      if (controller.signal.aborted) return;
      setAnswer({
        message: value.message,
        source_ids: value.source_ids as string[],
        actions: value.actions as Action[],
      });
      setStatus("Answer received. No proposed action has been applied.");
    } catch (e) {
      if (!controller.signal.aborted)
        setStatus(
          e instanceof Error
            ? e.message
            : "Codex unavailable. Local search remains available.",
        );
    } finally {
      if (request.current === controller) {
        active.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <section className="tl-codex" aria-label="Codex Navigator">
      <p>
        Your question and the selected project’s recorded context are sent
        through your local Codex CLI account. Requests start only when you press
        Ask Codex.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <label>
          Question for Codex
          <input
            data-testid="codex-question"
            value={question}
            maxLength={2048}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What is recorded for this project?"
          />
        </label>
        <button type="submit" disabled={busy || !question.trim()}>
          Ask Codex
        </button>
        {busy && (
          <button type="button" onClick={stop}>
            Stop Codex
          </button>
        )}
      </form>
      <p role="status" data-testid="codex-status">
        {status}
      </p>
      {answer && (
        <article>
          <h2>AI explanation · unverified</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{answer.message}</p>
          <p>
            Generated explanation, not witness evidence or human acceptance.
          </p>
          <h3>Recorded sources</h3>
          {!answer.source_ids.length && <p>Not found / not recorded.</p>}
          <ul>
            {answer.source_ids.map((id) => {
              const run = doc.runs.find(
                (r) => r.id === id && r.project_id === project,
              );
              const memory = doc.memory.find(
                (m) => m.id === id && m.project_id === project,
              );
              return (
                <li key={id}>
                  <button type="button" onClick={() => onSource(id)}>
                    {run?.title ?? String(memory?.text ?? id).slice(0, 120)}
                  </button>
                  <code>{id}</code>
                </li>
              );
            })}
          </ul>
          {answer.actions.length > 0 && (
            <>
              <h3>Proposed presentation actions</h3>
              <p>
                Review each proposal. Only your click applies it in this
                browser.
              </p>
              {answer.actions.map((a, i) => (
                <div key={i}>
                  <pre>{JSON.stringify(a, null, 2)}</pre>
                  <button
                    type="button"
                    onClick={() => {
                      if (!validAction(a, doc, project)) {
                        setStatus(
                          "Proposal rejected: current project or target changed.",
                        );
                        return;
                      }
                      setStatus(
                        onAction(a)
                          ? "View action applied locally · client acknowledged."
                          : "Action was not applied.",
                      );
                    }}
                  >
                    Ansicht öffnen · {a.type}
                  </button>
                </div>
              ))}
            </>
          )}
        </article>
      )}
    </section>
  );
}
