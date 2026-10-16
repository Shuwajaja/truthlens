import type { Run } from "../workspace.ts";
export function Badges({ run: r }: { run: Run }) {
  return (
    <div
      className="tl-badges"
      title="Values reported by the local exporter; this browser does not verify ledger signatures."
    >
      {[
        ["Origin", r.origin],
        ["Integrity", r.integrity],
        ["Check", r.verification],
        ["Review", r.review],
        ["Acceptance", r.acceptance],
      ].map(([k, v]) => (
        <span key={k}>
          {k}: {v}
        </span>
      ))}
    </div>
  );
}
