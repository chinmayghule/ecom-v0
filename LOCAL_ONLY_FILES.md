# Local-only files

**Read this before adding, removing, or committing anything that looks like tooling state.**

`AGENTS.md` links here instead of inlining the list, because `AGENTS.md` is sent to
every agent request on every task. This file is read only when it is relevant.

---

## The rule

> A file belongs in git only if someone who has never touched this machine needs it to
> build, run, or review the project.

Agent scratch, personal tooling state and secrets fail that test. Everything else passes.

## Local-only by design

These paths are excluded on purpose. Do not commit them.

| Path | What it is |
|---|---|
| `.planning/` | GSD planning state — roadmap, phase plans, UAT records |
| `.pam/` | PAM internal tooling |
| `.review/` | Dated AI code-review reports |
| `.scribble/` | Personal scratchpad and hand-written reports |
| `.opencode/` | opencode agent config and its `node_modules` |
| `graphify-out/` | Generated knowledge graph |
| `.vscode/` | Personal editor settings |
| `archive/` | Parked dead code, never built |
| `.env`, `.env.local`, `.env.test` | Secrets |
| `node_modules/`, `dist/`, `backend/coverage/`, `*.log` | Dependencies and build output |

`.env.example` is the exception — it is the shared template and **is** tracked.

The canonical `.env` lives at the repo root and is loaded by both `@nestjs/config` (runtime)
and `dotenv` (TypeORM CLI via `src/data-source.ts`). `backend/.env.example` is a stale
leftover from before the root convention, stays ignored, and exists to avoid two diverging
templates.

### Deliberately NOT ignored

`Dockerfile` was previously gitignored. It is now tracked, because Phase 1 deploys the
backend to Render via a multi-stage Dockerfile, and the rule above says a file belongs in
git when a fresh clone needs it to build or run the project. Container *artefacts* stay
excluded — `dist` and `node_modules` already cover them.

---

## Do not act on these without asking

**Do not add or remove entries in `.gitignore`, and do not change repo-wide conventions,
without asking the repository owner.**

These paths were excluded deliberately. A tool's default is not the project's decision —
the `.planning/` entry was once removed by an agent because its own tool wanted the files
committed, which staged 279 KB of scratch. If an agent believes an exclusion is wrong,
raise it — do not act on it.

Override the guards with `git commit --no-verify` only if you have already asked.

---

## What enforces this

Three guards, so the rule cannot be reversed by accident:

| Guard | Where | Prevents |
|---|---|---|
| `guard-ignored-tracked` | pre-commit | Staging a gitignored path. Scoped to the **staged set**, so one stale violation does not block unrelated commits. |
| `guard-local-only-dirs` | pre-commit | A local-only directory **stopping** being gitignored. Also cross-checks that `.gitignore` and the guard agree, so a newly ignored path is not silently unguarded. |
| whole-index sweep | CI (push + PR) | Tracked-and-ignored files anywhere in the tree — including ones introduced by a merge or a `--no-verify` push. Sweeps the whole index here because in CI there is no unrelated commit for a stale violation to block. |

The pre-commit guards are scoped to staged changes; the CI sweep is deliberately
whole-index. That asymmetry is intentional.

### Why `guard-local-only-dirs` keeps an explicit list

An earlier draft parsed the directory names out of `.gitignore` instead of stating them.
It failed open: deleting the `.review/` rule also dropped `.review` from the parsed list,
so the guard stopped checking the one directory that had just been unprotected. Verified —
it exited `0` with the rule removed.

To assert "this is still ignored", the name has to be recorded somewhere the rule cannot
delete. `.gitignore` states the intent; the guard states the invariant. They are cross-checked
against each other so neither can drift silently.

The names are committed in `.gitignore` either way, so an explicit list hides nothing. What
it buys is a second, independent record that must agree.