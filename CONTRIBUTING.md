# Contributing

## Development setup and checks

Start with the [development checks](docs/REVIEWER-GUIDE.md#development-checks)
for Python and Node versions, environment setup, tests, lint and viewer builds.
Use [STATUS](docs/STATUS.md) for measured results and known limitations.
Browser screenshots and accessibility review are separate from fast PR CI;
viewer changes must follow the [UI pipeline](docs/UI-PIPELINE.md).

## Branch naming

Work on a descriptive branch targeting `main`, for example:

```bash
git switch -c improve/my-change
```

Historical `w<N>/<slug>` branches are valid examples, not a required naming
scheme. Keep each change focused and state its acceptance criteria before
implementation.

## Workflow

- **No direct commits or pushes to `main`.** All changes must go through a
  pull request.
- Before merging, check the diff, meet the acceptance criteria, resolve blocking
  review findings and require green required CI on the current head.
- Under the owner's standing authorization, the supervising agent may
  squash-merge when those conditions hold. A fresh owner approval is not
  required for every PR. The authoritative [repository rules](AGENTS.md)
  describe the authorization and its limits; task-specific user constraints
  take precedence.
- Security-sensitive changes retain `needs-codex-review` and require an
  independent Codex review; an author cannot approve their own security change.
  See the repository rules for the covered paths and review evidence.
- A repository merge does not authorize deployment, live service changes or
  other operations requiring separate authorization.

## Agent-authored changes

When an AI agent authors a pull request, agent decisions (approvals,
rejections, sign-offs) must be recorded with `actor.kind = agent`. Agents
must never represent themselves as human approvers. Repository workflow
authorization is not product-level human approval: `approval.granted` and
`criteria.confirmed` retain their frozen human actor and signature rules.

Report the tested commit or tree, commands, observed results and limitations.
Skipped checks and synthetic fixtures do not prove a live service or a real
human approval. Preserve the frozen contracts and the G1/D34 agent boundary:
agents receive only `passed`, `failed` or `not_checkable` status.
