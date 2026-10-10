# Git & GitHub Workflow

Where work goes and how it lands. `COMMIT_STYLE.md` covers how a commit message
is written; `GIT_CONVENTIONS.md` covers commit-message format and branch naming.

## Branch flow

```
feature/* | chore/* | fix/* | docs/*   →   PR   →   dev   →   PR   →   main
```

Two long-lived branches. `dev` is the integration branch and is always
complete. `main` is what a deploy reads.

## Merge strategy

| From | To | Method | Why |
|---|---|---|---|
| `feature/*` | `dev` | **Rebase and merge** | Short-lived branches. Keeps `dev` linear, and the real commits survive instead of collapsing into one. |
| `dev` | `main` | **Merge commit** | Carries `dev`'s commits into `main`'s ancestry, and records that a promotion happened. |

Squash merging stays **available** — it is occasionally the right tool for
collapsing a genuinely noisy branch. It is simply not the default on either path.

Branch protection already supports this: `dev` requires linear history, so rebase
merges are what it accepts; `main` has linear history disabled precisely so it can
take promotion merge commits.

### Why `dev → main` must not be squashed

`dev` is not short-lived — it is worked on continuously. A squash creates a new
commit instead of carrying `dev`'s commits into `main`'s ancestry, leaving the two
with identical files but unrelated histories.

That is not hypothetical here. Promotions #13 and #17 were squash-merged:

```
$ git rev-list --count origin/main..origin/dev
13
$ git rev-list --count origin/dev..origin/main
2                                       # e36971d, 41f6698 — both squashes
```

`main` does not contain `dev`'s commits; it contains squashed replacements. The
trees match, so nothing looks wrong. But a merge commit conflicts **today**:

```
CONFLICT (content): AGENTS.md
CONFLICT (content): COMMIT_STYLE.md
CONFLICT (add/add):  GIT_CONVENTIONS.md
```

`main`'s squash rewrote those files, then `dev` changed them again, so both sides
look modified. One promotion using **Create a merge commit** — taking `dev`'s side
of those three files — resolves the divergence permanently.

## GSD phase branches

Each GSD phase gets its own branch, created **before** planning, so the plan and
the code it describes land in one PR:

```
feature/03-data-integrity-and-code-quality

  /gsd-discuss-phase 3    →  03-CONTEXT.md
  /gsd-plan-phase 3       →  03-PLAN.md
  /gsd-execute-phase 3    →  the code
                          →  one PR carrying decisions, plan, and implementation
```

Naming is `feature/<NN>-<slug>`, matching `.planning/phases/<NN>-<name>/`. The
number goes first so branches sort in phase order and map directly onto the phase
directories. It is not a tool-specific prefix, so `GIT_CONVENTIONS.md`'s ban on
`gsd/`, `claude/` and similar still holds.

Two consequences worth stating:

- **The plan is part of the deliverable.** A reviewer reads the reasoning and the
  implementation in one diff, and `dev` only ever receives complete, reviewed phases.
- **One phase at a time.** `ROADMAP.md` and `STATE.md` are shared across every
  phase branch, because each phase marks its own phase complete. Two phases worked
  at once would conflict on exactly those two files.

## Protected branches

**`origin/main` is never pushed to directly.** It changes only via a promotion
PR from `origin/dev`. Branch protection enforces this for every push, from any
branch, including the owner.

**`origin/dev` is never deleted.** The usual "delete the branch after merging"
advice is for short-lived feature branches, where deletion signals completion.
`dev` is the integration branch. Never pass `--delete-branch` on a promotion PR:
`gh pr merge --delete-branch` deletes the PR's *head* branch, which for a
`dev → main` PR is `dev`.

## Human review

**No PR merges into `origin/dev` without a human having read it.** This applies
to agents as much as to anyone else: an agent-authored PR is not self-reviewed.

**GitHub cannot enforce this on a solo repository, and no setting changes that.**
Authors cannot approve their own pull requests — the API returns
`422 Review Can not approve your own pull request`, verified against this repo.
The Approve button stays greyed out even at zero required reviews.

So `required_approving_review_count` is **0 on both branches**. Setting it to 1
does not mean "review required" — it means "nothing can ever merge", because the
only person who can review is the person who wrote the code. That is the trap this
repository fell into twice before.

What actually enforces safety is therefore CI, not a human:

| Branch | Approvals | Enforce admins | Linear | Conversation resolution |
|---|---|---|---|---|
| `dev` | 0 | no | yes | no |
| `main` | 0 | **yes** | no | **yes** |

`main` is the protected one. `enforce_admins: true` means no one — including the
owner and any agent holding a token — can push to it without opening a PR and
getting `quality` green. `dev` is deliberately looser so a solo maintainer can
work, and because nothing deploys from it.

### What "approve" means here

Since GitHub will not record a self-approval, review happens outside the UI:

1. Read the diff and the PR description.
2. Say so in the conversation.
3. The merge is performed on that instruction.

The mechanism is conversation, not a green checkmark. That is a real limitation of
a solo repository and worth being honest about rather than papering over with a
setting that silently does nothing.

If a second human is ever available, raise the approval count to 1 — it will work
immediately, because the deadlock is a shortage of reviewers, not a config error.
A review-bot app is the other option; it is a separate GitHub actor, so it is
permitted to approve.

### The general lesson

**A control that cannot be satisfied is not a control. It is a blockage.**

The approval requirement blocked every promotion; the bypass was taken to get work
done; the bypass silently broke the merge strategy above. Nothing about that was
dishonest — the protection did exactly what it was configured to do. The mistake
was configuring a guarantee the project could not honour.

Prefer a gate that is genuinely enforceable and actually runs — here, CI — over
one that is demanding and impossible.

## CI

`ci.yml` triggers on `pull_request` and on `push` to `dev` and `main`. A push to
a feature branch runs nothing, which is why work-in-progress stays local.

Every PR into either branch runs the full pipeline: local-only guard, lint,
`nest build`, migration smoke (apply → revert → apply on an empty database),
`test:cov`, integration against real PostgreSQL, and E2E via `supertest` against
the real `AppModule`.

**Required status checks are configured by job name**, which is `quality` — the
single job in `ci.yml`. A check name that never reports can never pass, and the
symptom is a PR that is `MERGEABLE` and `BLOCKED` simultaneously with a green
check and no failing run. Update branch protection in the same commit that
renames the job; changing protection also does not re-evaluate checks that
already ran.

## Branch protection settings

These live in the GitHub API, not in a file. Nothing in the repository will tell
you if they drift. Verified 2026-10-10:

| Branch | Setting | Value |
|---|---|---|
| `dev` | required status checks | `quality` (strict — must be current) |
| `dev` | required approving reviews | 0 — GitHub cannot enforce this solo; see *Human review* |
| `dev` | enforce admins | no — owner works here directly |
| `dev` | dismiss stale reviews | yes |
| `dev` | require linear history | yes — this is why `feature/* → dev` rebases |
| `dev` | require conversation resolution | no |
| `dev` | allow deletions / force pushes | no / no |
| `main` | required status checks | `quality` (strict — must be current) |
| `main` | required approving reviews | 0 — same reason |
| `main` | enforce admins | **yes** — no direct pushes, owner and agents included |
| `main` | dismiss stale reviews | yes |
| `main` | require linear history | no — this is what allows promotion merge commits |
| `main` | require conversation resolution | yes |
| `main` | allow deletions / force pushes | no / no |
| repository | merge methods enabled | merge, rebase, **and** squash |
| repository | delete branch on merge | no |
| repository | rulesets | none — the guarantees above are branch protection only |

Three asymmetries are intentional, and each one is load-bearing:

- **`enforce_admins` differs** (`dev` no, `main` yes). `dev` must stay workable by a
  solo owner; `main` must not be touchable by anyone without a PR and green CI.
- **`require_linear_history` differs** (`dev` yes, `main` no). `dev` stays a clean
  linear line; `main` needs the merge commit that records a promotion.
- **`require_conversation_resolution` differs** (`dev` no, `main` yes). Promotions
  should not land with an unresolved thread attached.

There is no ruleset on this repository. Anything described elsewhere as a
"bypass list" does not exist here — all of the above is branch protection.

## Local hooks

`lefthook.yml` pre-push runs `lint`, `nest build`, and `test:cov`. Because
`nest build` resolves every import, a commit that does not compile cannot be
pushed. `LEFTHOOK=0` or `--no-verify` skips this; use it rarely.