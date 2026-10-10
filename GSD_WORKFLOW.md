# GSD Workflow

How the GSD planning state is organised, why it is tracked in git, and what keeps
it honest. Read this before changing anything under `.planning/`.

---

## The incident this file exists to prevent

On **2026-10-10** the entire planning state went missing: `ROADMAP.md`,
`STATE.md`, `PROJECT.md`, `01-CONTEXT.md`, and `01-DISCUSSION-LOG.md`.

The cause was not a bug in GSD. It was a policy decision made in `aece01a`, which
gitignored `.planning/` in full on the reasoning that it was "agent scratch for one
machine." That reasoning was half right — and the half that was wrong cost the
project its roadmap.

**A gitignored directory is unprotected, not merely untracked.** Git has no record
of it. `git reset --hard`, `git clean -fd`, a fresh clone, a new laptop, or a
reinstall all remove it silently and permanently. The commit message even said
*"Files stay on disk"* — they did, for a while, and then they didn't.

Three files were recoverable, because they had been force-added to git before the
ignore rule landed and so survived in history. `ROADMAP.md` was never tracked and
had to be rebuilt from `ecom_project_master.md`.

---

## What is tracked and what is not

The distinction is **durable project artifact vs. ephemeral session state**. It is
not "mine vs. theirs" — a roadmap written by an agent is still the project's
roadmap.

| Tracked | Why |
|---|---|
| `.planning/ROADMAP.md` | What we're building, in what order |
| `.planning/STATE.md` | Where we are — the first file every agent reads |
| `.planning/PROJECT.md` | What the project is, constraints, decisions |
| `*-CONTEXT.md`, `*-DISCUSSION-LOG.md` | Why we chose this approach (ADRs) |
| `*-PLAN.md`, `*-SUMMARY.md` | What was built, and how |
| `*-VERIFICATION.md`, `*-UAT.md` | Evidence it actually works |
| `.planning/codebase/` | Architecture research |

| Ignored | Why |
|---|---|
| `.planning/**/.continue-here.md` | Transient checkpoint marker, meaningless to anyone else |
| `.planning/**/*HANDOFF*.md` | Same — records where one session stopped mid-thought |
| `.planning/**/*handoff*.json` | Same |

This is the same split the industry makes between ADRs and scratch notes. An ADR is
committed because six months later someone needs to know *why*; a sticky note is not.

**Never add `.planning/` back to `.gitignore`.** If a tool appears to want that,
the tool is wrong. `LOCAL_ONLY_FILES.md` records a previous agent removing this
exact ignore rule because its own tooling wanted the files committed — the guards
below now make that a hard failure rather than a convention.

---

## What enforces it

| Guard | Where | Prevents |
|---|---|---|
| `guard-ignored-tracked` | pre-commit | Staging a gitignored path. Scoped to the staged set. |
| `guard-local-only-dirs` | pre-commit | A local-only directory *stopping* being gitignored |
| `guard-planning-tracked` | pre-commit | **`.planning/` becoming unprotected again** |
| whole-index sweep | CI (push + PR) | Tracked-and-ignored files anywhere in the tree |
| Guard planning state | CI (push + PR) | Planning files missing or untracked in the repo |

`guard-planning-tracked` is the one that would have stopped this incident. It
asserts both that `ROADMAP.md` / `STATE.md` / `PROJECT.md` are **not** gitignored
and that they are **actually tracked** — a file that exists but was never committed
is exactly as lost as one that was deleted.

The pre-commit guards are scoped to staged changes; the CI sweep is whole-index.
That asymmetry is deliberate: locally, one stale violation should not block an
unrelated commit; in CI there is no unrelated commit to protect.

---

## Checking health

```bash
pnpm gsd:doctor          # or: scripts/gsd-doctor.sh
```

Seven checks:

1. **Structure** — the required files exist
2. **Protection** — they are tracked and not ignored
3. **Roadmap vs disk** — every roadmap phase has a directory, and every directory is in the roadmap
4. **STATE.md freshness** — it is not stale, and its completed-phase count matches the roadmap's checkmarks
5. **Checkpoints** — no unresolved `.continue-here.md`
6. **Orphaned context** — a CONTEXT with no PLAN, i.e. work scoped but never executed
7. **Records** — completed phases have summaries for their plans

Run it at the start of a session and after any bulk filesystem operation. Exit
code 1 means something needs fixing.

Checks 4 and 6 catch the subtler failure: a `STATE.md` that is *present but wrong*
is more dangerous than a missing one, because it is believed. The copy recovered on
2026-10-10 claimed Phase 01 was at 0% while Phases 01 and 02 had both shipped.

---

## How phases map to the master document

This is the thing most likely to be got wrong by a future agent.

`ecom_project_master.md` defines **5 macro-stages** for the whole project. GSD works
on a finer grain, and its phases are **not** the same thing.

**"Phase" means GSD phase. Always.** The master document says "stage". This was not
always true — both used "phase" until 2026-10-10, and the collision caused a wrong
conclusion before it was noticed. The master document carries a table comparing the
two in its §2.2.

```
Master doc  ──▶  GSD milestones
  Stage 1  Complete Monolith        ──▶  current milestone (11 phases)
  Stage 2  Hardened Monolith        ──▶  future milestone
  Stage 3  Microservices            ──▶  future milestone
  Stage 4  Mobile Client (optional) ──▶  future milestone
  Stage 5  Production (optional)    ──▶  future milestone

Stage 1  ──▶  GSD phases 01–11
  01 Security Hardening & Foundation   ✅
  02 Product Catalog                    ◐  partial
  03 Data Integrity & Code Quality      ○  ← current
  04 Catalog Completion
  05 Cart & Addresses
  06 Orders & Checkout
  07 Seller & Admin Management
  08 API Documentation & Auth Hardening
  09 Seeds & Docker Packaging
  10 Frontend & Component Library
  11 Observability & Deployment
```

So: **when the master doc changes stage structure, the GSD roadmap must be re-derived,
not patched.**

Two things make that re-derivation reliable, both learned the hard way:

- **`WORK-INVENTORY.md` holds the tasks, `ROADMAP.md` holds the grouping.** Re-derive
  the grouping without re-deciding what work exists.
- **Derive from what the code needs, not from what a commit says.** The first rebuilt
  roadmap marked Phase 02 complete because PR #12 read like a finished catalog. It was
  not — inventory had an entity and no code at all. Read the modules, not the messages.

---

## Routine workflow

| Situation | Command |
|---|---|
| Start a session | `pnpm gsd:doctor`, then `/gsd-progress` |
| Know what is next | `/gsd-progress --next` |
| Begin the next phase | `/gsd-discuss-phase 3` |
| Turn decisions into plans | `/gsd-plan-phase 3` |
| Build it | `/gsd-execute-phase 3` |
| Prove it works | `/gsd-verify-work 3` |

`ROADMAP.md`, `STATE.md`, and `PROJECT.md` are authoritative for phase state.
`AGENTS.md` is a secondary config aid and goes stale.

### When a phase completes

Mark it complete in **both** `ROADMAP.md` (the `- [x]` checklist) and `STATE.md`
(`completed_phases`) — check 4 of `gsd-doctor` compares them, because they drifting
apart is how a phase ends up invisible to `/gsd-progress`.

### When work ships without planning artifacts

This already happened once: Phase 02 (catalog) merged with no context, plan, or
UAT record. Write the records retroactively and mark them as reconstructed. An
honest gap in the record beats a confident invention — `02-CONTEXT.md` documents
which decisions are recoverable from the code and which are not.

---

## Recovery

If planning state is lost again:

```bash
# What was recoverable came from the commit before the untracking
git show aece01a^:.planning/STATE.md > .planning/STATE.md
git show aece01a^:.planning/PROJECT.md > .planning/PROJECT.md

# Check what else git still knows about
git log --all --diff-filter=D --name-only -- '.planning/'
```

Then rebuild anything unrecoverable from `ecom_project_master.md` and `git log`,
mark it as a rebuild, and say plainly that it is not the original. Do not quietly
present a reconstruction as a restoration — the roadmap written on 2026-10-10 is a
*new* roadmap, and pretending otherwise would have hidden how much of it was guesswork.
