# Git & GitHub Workflow

Branch flow, merge strategy, review requirements, and the branch-protection
settings that enforce them.

- `COMMIT_STYLE.md` — how a commit message is *written*
- `GIT_CONVENTIONS.md` — commit-message format and branch naming in detail
- **This file** — where work goes, how it lands, and what guards it

## Branch flow

```
feature/* | chore/* | fix/* | docs/*   →   PR   →   dev   →   PR   →   main
```

Two long-lived branches. `dev` is the integration branch and is always
complete. `main` is what a deploy reads and only ever receives work promoted
from `dev`.

**Do not add a `staging` or `testing` branch.** Fewer long-lived branches is
the current consensus. Trunk-based development uses `main` alone; GitHub Flow
uses `main` alone; GitFlow adds one more (`develop`); GitLab Flow adds two. The
documented cost of every additional long-lived branch is that it drifts — and a
drifted branch is what produces conflicts that do not correspond to any real
difference in the code. Multiple *environments* (Render, Vercel, Neon) are
handled by deploying the same artifact to different places, not by adding
branches.

## Merge strategy

| From | To | Method | Why |
|---|---|---|---|
| `feature/*` | `dev` | **squash** | short-lived branch, one logical change |
| `dev` | `main` | **merge commit** | `dev` is long-lived and keeps being worked on |

**Why promotions must not be squashed.** GitHub's merge-methods documentation
states:

> Squash merging works best for short-lived branches. If you keep working on
> the same head branch after a squash merge, later pull requests can include
> commits that were already squashed into the base branch. This can make merge
> conflicts more likely and can force you to resolve the same conflicts more
> than once.

`dev` is not a short-lived branch — it is worked on continuously. Squash-merging
`dev → main` is the exact case that guidance warns about, and it is what
produced repeated conflicts here.

A squash creates a brand-new commit instead of carrying `dev`'s commits into
`main`'s ancestry, so `main` and `dev` end up with identical file contents but
unrelated histories. GitHub then has to reason about promotions from a merge
base many commits old and can report a conflict where the trees match exactly.

A **merge commit** preserves ancestry: `main` contains `dev`'s commits, so
promotions are ordinary merges.

## `origin/main` is never pushed to directly

**The only path by which `origin/main` changes is a promotion PR from
`origin/dev`.**

- Never `git push origin main`.
- Never push to `main` from a local `main` branch.
- Never `git push <anything>:main`.

GitHub branch protection enforces this for every push, from any branch,
including the owner. A local `main` is never a source for `origin/main`, and it
can be arbitrarily stale — a branch cut from one carries whatever that commit
happened to have tracked. During development this silently re-added two
gitignored `archive/` files into a documentation-only commit, because the
branch had been cut from a stale local `main` rather than `origin/dev`.

## `origin/dev` is never deleted

**`dev` is a long-lived integration branch and is deleted never.**

The usual GitHub advice to delete a branch after merging it applies to
*short-lived feature branches*, where deletion signals "this work is finished".
`dev` is not one of those.

The specific hazard: `gh pr merge <n> --delete-branch` deletes the **head**
branch of that PR. For a promotion PR (`dev → main`) the head **is `dev`**, so
that flag is capable of deleting the integration branch. This happened once
here — the deletion was rejected only because branch protection blocked it,
which is luck rather than design. Never pass `--delete-branch` on a promotion
PR.

`dev` has `allow_deletions: false`, so GitHub rejects any attempt with
`HTTP 422 Cannot delete this branch`. This has been verified by attempting it.

## Human review is required before merging into `dev`

**No PR merges into `origin/dev` without an approving review from at least one
human.** GitHub enforces this: `required_approving_review_count` is `1`.

- Applies to every change type — feature, chore, docs, bugfix, refactor, test.
- Applies to agents exactly as it applies to anyone else. **An agent-authored PR
  is not self-reviewed.** An agent that wrote the code cannot approve it.
- Self-approval is enabled in repository settings, which is what makes a
  one-review rule workable in a solo project instead of merely aspirational.

**Exception:** a change so small that reviewing it costs more than the change
itself — a typo, a one-line correction, an obviously mechanical edit.

**Not exempt:** anything that alters behaviour, adds a dependency, changes a
migration, touches authentication or authorization, or is not immediately
verifiable by reading the diff. When unsure, ask.

## What CI runs, and where

`ci.yml` triggers on `pull_request` and on `push` to `dev` and `main`. **A push
to a feature branch runs nothing at all**, which is why work-in-progress is
kept local rather than pushed and worked around.

Every PR — into `dev` or into `main` — runs the full pipeline:

| Step | What it proves |
|---|---|
| local-only guard | nothing gitignored is tracked |
| lint (Biome) | syntax, formatting, import order |
| `nest build` | the project typechecks and every import resolves |
| migration smoke | the migration chain applies to an *empty* database, and reverts |
| `test:cov` | unit suite, with coverage thresholds |
| integration | real SQL against a real PostgreSQL |
| E2E | the real HTTP surface, via `supertest` against the real `AppModule` |

E2E is API-level, not browser-level. `supertest` is the package the NestJS
documentation recommends; the specs boot the real application module against a
real database on port 5433 and exercise HTTP. No browser is involved, and this
does not change when a frontend is added.

### Required status checks are configured by job name

`dev` and `main` both require a check named `quality` — the single job in
`ci.yml`. This is a silent failure mode:

- `main` once required a check named `continuous-integration`, a name the
  workflow never reports.
- A check that never reports can never pass.
- The symptom is `mergeable=MERGEABLE` with `state=BLOCKED`, a **green**
  `quality` check, and no failing run and no error message anywhere.

Renaming the job reproduces this immediately. Update branch protection in the
same commit that renames the job. Changing branch protection also does not
re-evaluate checks that already ran, so re-run CI after the change.

## WIP stays local

`lefthook.yml` runs three commands on **pre-push**: `lint`,
`build-backend` (`nest build`), and `test-backend` (`test:cov`).

`nest build` resolves every import in the project, so **a commit that does not
compile cannot be pushed** — the hook fails. This is deliberate: pre-push gates
a push the same way CI gates a PR. Work is kept local until the branch is a
complete, buildable unit.

`LEFTHOOK=0 git push` and `--no-verify` both skip the hook. That is the escape
hatch for pushing something knowingly broken, and it should stay rare.

## GitHub settings backing the rules above

These live in the GitHub API, not in a file. They are recorded here because
nothing inside the repository will tell you if they drift.

| Branch | Setting | Value | Why |
|---|---|---|---|
| `dev` | required status checks | `quality` | CI must pass |
| `dev` | required approving reviews | **1** | human review; self-approval allowed |
| `dev` | dismiss stale reviews | yes | an old approval should not count after new commits |
| `dev` | require linear history | yes | squash-merged, one commit per PR |
| `dev` | **allow deletions** | **no** | `dev` must never be deleted |
| `dev` | allow force pushes | no | |
| `main` | required status checks | `quality` | |
| `main` | require conversation resolution | yes | every review thread resolved |
| `main` | enforce admins | yes | including the owner |
| `main` | **require linear history** | **no** | lets a promotion land as a merge commit |
| `main` | allow deletions | no | |
| `main` | allow force pushes | no | |
| repository | allow self-approval | yes | makes the one-review rule workable solo |
| repository | delete branch on merge | no | avoids auto-deleting anything |

## Conventions that have bitten

Each of these cost real time. None are hypothetical.

### Squash-merging into `main` made it look permanently behind

Because a squash never carries `dev`'s commits into `main`'s ancestry,
`git log origin/main..origin/dev` lists every commit since the last promotion,
and the count only grows — while the trees are identical. Compare content,
never ancestry:

```sh
git diff --stat origin/main origin/dev
```

An empty diff means the trees agree. Ancestry comparison does not tell you
whether `main` actually has the work.

### A promotion PR conflicted even though the trees matched

Squash-merging into `main` left the two branches historically unrelated, so
GitHub merged from a merge base many commits old, saw both sides as having
independently edited the same file, and reported a conflict. Nothing was wrong
with the diff. Merge commits for promotions fix this at the root.

### Deleting `dev` was attempted, once

`gh pr merge --delete-branch` on a `dev → main` PR targets the head branch,
which is `dev`. See the `dev` section above.

### Required status checks are configured by job name

Not by workflow file. See the CI section above.

### Cut branches from `origin/dev`, never from local `main`

See the `origin/main` section above.