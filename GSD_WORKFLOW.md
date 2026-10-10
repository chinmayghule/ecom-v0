# GSD Workflow

How the planning state is organised in this repository. This file holds the
**rules**. The planning state itself is authoritative elsewhere — see
*Single source of truth* below.

## Single source of truth

One file per fact. Everything else links here rather than restating it, because
the duplication this replaced had already drifted.

| Question | Answer lives in |
|---|---|
| What phases exist, what is next | `.planning/ROADMAP.md` |
| What work is outstanding, with dependencies | `.planning/WORK-INVENTORY.md` |
| Where we are right now | `.planning/STATE.md` |
| What the project is, constraints, decisions | `.planning/PROJECT.md` |
| Stage → phase mapping | `.planning/ROADMAP.md` header |
| Which paths are gitignored | `LOCAL_ONLY_FILES.md` |
| Branch flow, merge strategy, protection | `GIT_WORKFLOW.md` |

`AGENTS.md` is a secondary config aid and goes stale.

The **stage → phase mapping is defined once, in `ROADMAP.md`.** Do not restate it
here; link to it. Stage (master document, 5, fixed) and Phase (GSD, ~8 per stage,
re-derived) are different things with different numbering.

## What is tracked

`.planning/` is **tracked**. Only ephemeral session markers are ignored:
`.continue-here.md` and handoff files.

Planning records are project documentation — the equivalent of ADRs — not scratch.
A gitignored directory is *unprotected*, not merely untracked: `git reset --hard`,
`git clean -fd`, a fresh clone, or a new machine delete it with no recovery path.
That is not hypothetical; it happened here on 2026-10-10. Full account:
[#19](https://github.com/chinmayghule/ecom-v0/pull/19).

Never add `.planning/` to `.gitignore`.

## What enforces it

| Guard | Where | Prevents |
|---|---|---|
| `guard-ignored-tracked` | pre-commit | Staging a gitignored path |
| `guard-local-only-dirs` | pre-commit | A local-only dir *stopping* being ignored |
| `guard-planning-tracked` | pre-commit | `.planning/` becoming unprotected, **or** state files existing but never being committed |
| local-only sweep | CI | Tracked-and-ignored files anywhere in the index |
| Guard planning state | CI | Planning files missing or untracked in the repo |

## Checking health

```bash
pnpm gsd:doctor
```

Seven checks: structure, protection, roadmap-vs-disk drift, `STATE.md` staleness,
dangling checkpoints, **orphaned context** (a `CONTEXT.md` with no plan beside it —
the shape that hid Phase 01B), and completed phases whose plans lack summaries.

Run it at session start and after any bulk filesystem operation. Exit 1 means
something needs fixing.

## Routine workflow

Each phase runs on its own branch, **created before planning**, so the plan and the
code it describes land in one PR. Naming is `feature/<NN>-<slug>`.

```
git switch dev && git pull
git checkout -b feature/03-data-integrity-and-code-quality

/gsd-discuss-phase 3      →  03-CONTEXT.md
/gsd-plan-phase 3         →  03-PLAN.md
/gsd-execute-phase 3      →  the code
/gsd-verify-work 3        →  evidence

gh pr create               →  dev, using "Rebase and merge"
```

`/gsd-plan-phase` and `/gsd-discuss-phase` commit to the current branch, so create
the branch first — otherwise the plan lands on `dev` and the PR shows
implementation without its reasoning.

**There is no `/gsd-complete-phase` command.** The phase gate is
`/gsd-verify-work N`; `/gsd-complete-milestone` closes a milestone, not a phase.
Closing a phase is then the two manual edits below.

### Closing a phase

1. Mark it `- [x]` in the `ROADMAP.md` summary checklist.
2. Update `completed_phases` and the position block in `STATE.md`.

Both, because `gsd-doctor` check 4 compares them — drift between them is how a
phase becomes invisible to `/gsd-progress`.

**One phase at a time.** Every phase branch edits `ROADMAP.md` and `STATE.md`;
two phases at once conflict on exactly those files.

## Recovery

If planning state is lost again:

```bash
git log --all --diff-filter=D --name-only -- '.planning/'
git show <ref>:.planning/STATE.md > .planning/STATE.md
```

Rebuild anything unrecoverable from `ecom_project_master.md` and `git log`, and
**label it a rebuild**. Do not present a reconstruction as a restoration — the
roadmap written on 2026-10-10 was a new roadmap, and calling it the old one would
have hidden how much of it was guesswork.

## Re-deriving the roadmap

When `ecom_project_master.md` changes stage structure, re-derive the grouping from
`WORK-INVENTORY.md` — do not patch `ROADMAP.md`, and do not re-decide what work
exists.

**Derive from what the code needs, not from what a commit says.** A roadmap built
from merge messages marked Phase 02 complete when inventory had an entity and no
implementation at all. Read the modules.