# Git & GitHub Workflow

Where work goes and how it lands. Message format and branch naming:
`GIT_CONVENTIONS.md`. How a commit message is written: `COMMIT_STYLE.md`.

## Branch flow

```
feature/* | chore/* | fix/* | docs/*  →  PR  →  dev  →  PR  →  main
```

`dev` is the integration branch and is always complete. `main` is what a deploy
reads.

## Rules

| # | Rule |
|---|---|
| 1 | Never push to `origin/main`. It changes only via a promotion PR from `dev`. |
| 2 | Never delete `origin/dev`. Never pass `--delete-branch` on a promotion PR — it deletes the head branch, which for `dev → main` is `dev`. |
| 3 | Never merge into `origin/dev` without the owner having read the diff. An agent-authored PR is not self-reviewed. |
| 4 | One GSD phase per branch, created before planning: `feature/<NN>-<slug>`. |
| 5 | One phase at a time. `ROADMAP.md` and `STATE.md` are shared by every phase branch. |

## Merge strategy

| From | To | Method |
|---|---|---|
| `feature/*` | `dev` | **Rebase and merge** |
| `dev` | `main` | **Merge commit** |

Squash is available for collapsing a noisy branch; it is not the default on either
path.

**Why not squash on `dev → main`:** `dev` is long-lived and continuously worked on.
Squashing creates a new commit instead of carrying `dev`'s commits into `main`'s
ancestry, so the branches end up with identical trees and unrelated histories —
which makes every future promotion conflict. This happened twice here (#13, #17)
and cost three doc files. Full account: [#19](https://github.com/chinmayghule/ecom-v0/pull/19).

Branch protection already enforces this pairing: `dev` requires linear history, so
it accepts rebase merges; `main` has linear history disabled, which is what allows
promotion merge commits.

## Human review

GitHub rejects self-approval outright — `422 Review Can not approve your own pull
request`. That is not a setting, so **both branches sit at zero required reviews**.
Setting it to 1 would mean "nothing can ever merge", because the only reviewer
available is the author.

What actually enforces safety is CI. `main` has `enforce_admins: true`, so no one —
owner or agent — can push to it without a PR and a green `quality` run. `dev` is
deliberately looser, because nothing deploys from it.

**What "approved" means here:** review happens in conversation. Read the diff, say
so, merge on that instruction. GitHub will not hold the record.

If a second human becomes available, raise the approval count to 1 — it works
immediately, because the deadlock is a shortage of reviewers, not misconfiguration.

## CI

`ci.yml` runs on every PR and on pushes to `dev` and `main`. Every PR runs:
local-only guard, planning-state guard, lint, `nest build`, migration smoke (apply →
revert → apply on an empty database), `test:cov`, integration against real
PostgreSQL, and E2E.

**Required status checks are configured by job name** — `quality`, the single job.
A check name that never reports can never pass, and the symptom is a PR that is
`MERGEABLE` and `BLOCKED` at once with a green check. Update branch protection in
the same commit that renames the job.

## Branch protection settings

These live in the GitHub API, not in a file. Nothing in the repo detects drift.
Verified 2026-10-10.

| Setting | `dev` | `main` |
|---|---|---|
| required status checks | `quality` (strict) | `quality` (strict) |
| required approving reviews | 0 | 0 |
| enforce admins | no | **yes** |
| require linear history | **yes** | no |
| require conversation resolution | no | **yes** |
| dismiss stale reviews | yes | yes |
| allow deletions / force pushes | no / no | no / no |

| Repository | Value |
|---|---|
| merge methods | merge, rebase, squash |
| delete branch on merge | no |
| rulesets | **none** — all of the above is branch protection |

The three asymmetries are load-bearing: `enforce_admins` keeps `main` untouchable,
linear history keeps `dev` clean, and conversation resolution stops a promotion
landing with an unresolved thread.

## Local hooks

`lefthook.yml` pre-push runs `lint`, `nest build`, and `test:cov`. Because
`nest build` resolves every import, code that does not compile cannot be pushed.
`LEFTHOOK=0` or `--no-verify` skips it; use rarely.