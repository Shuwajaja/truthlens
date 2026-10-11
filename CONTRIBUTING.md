# Contributing

## Branch naming

All branches follow the pattern `w<N>/<slug>`, where `<N>` is the work week
number and `<slug>` is a short kebab-case description of the work.

Examples: `w1/ledger-core`, `w2/artifact-manifest`, `w3/web-viewer`.

## Workflow

- **No direct commits or pushes to `main`.** All changes must go through a
  pull request.
- Pull requests are merged only after the repository owner has reviewed and
  approved.
- CI must be green before a pull request can be merged.

## Agent-authored changes

When an AI agent authors a pull request, agent decisions (approvals,
rejections, sign-offs) must be recorded with `actor.kind = agent`. Agents
must never represent themselves as human approvers.