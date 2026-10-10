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

| From | To | Method |
|---|---|---|
| `feature/*` | `dev` | squash |
| `dev` | `main` | merge commit |

Squash-merging `dev → main` is wrong because `dev` is not short-lived — it is
worked on continuously. A squash creates a new commit instead of carrying
`dev`'s commits into `main`'s ancestry, leaving the two with identical files but
unrelated histories, which makes promotions conflict. GitHub's
[merge-methods docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github)
state that squash merging "works best for short-lived branches".

Squashing `feature/* → dev` is correct: those branches are short-lived and one
PR is one logical change.

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

**GitHub cannot enforce this on a solo repository.** Authors cannot approve
their own pull requests, and there is no setting to change that — the API
returns `422 Review Can not approve your own pull request`. With one
maintainer there is no second human, so `required_approving_review_count: 1`
would leave the repository permanently unmergeable.

The owner is therefore on the ruleset bypass list, which means the approval
requirement does not apply to them. Everything else still does: `dev` and `main`
require a PR, require CI to pass, and block deletion and force-pushes.

What that leaves is a rule held to rather than enforced. Reviewing your own diff
before opening the PR is the mechanism; the guardrail does not exist.

A change so small that reading it costs more than the change itself — a typo, a
one-line correction, an obviously mechanical edit — does not need it. Not exempt:
anything altering behaviour, adding a dependency, changing a migration, or
touching auth.

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
you if they drift.

| Branch | Setting | Value |
|---|---|---|
| `dev` | required status checks | `quality` |
| `dev` | required approving reviews | 1 — bypassed by the ruleset |
| `dev` | dismiss stale reviews | yes |
| `dev` | require linear history | yes |
| `dev` | allow deletions / force pushes | no |
| `main` | required status checks | `quality` |
| `main` | require conversation resolution | yes |
| `main` | require linear history | no — allows promotion merge commits |
| `main` | enforce admins | yes |
| `main` | allow deletions / force pushes | no |
| repository | delete branch on merge | no |
| ruleset | bypass list | repository owner (`chinmayghule`) |

The bypass covers the approval requirement only. PRs, CI, and the delete /
force-push blocks still apply to the owner.

## Local hooks

`lefthook.yml` pre-push runs `lint`, `nest build`, and `test:cov`. Because
`nest build` resolves every import, a commit that does not compile cannot be
pushed. `LEFTHOOK=0` or `--no-verify` skips this; use it rarely.