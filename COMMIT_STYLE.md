# Commit Style

This project follows **Conventional Commits** (`<type>(<scope>): <description>`).

## Types

| Type | When to use |
|------|-------------|
| `feat` | A new feature or endpoint |
| `fix` | A bug fix |
| `chore` | Build, deps, tooling, config — no production code change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `docs` | Documentation only |
| `test` | Adding or fixing tests |
| `perf` | Performance improvement |

## Scope (optional)

Module or package name, e.g. `auth`, `backend`, `frontend`, `ci`.

## Description

- Imperative mood ("add" not "added" / "adds")
- Lowercase after the colon
- No trailing period

## Examples

```
feat(auth): add password reset with opaque token flow
fix: resolve null pointer in user update when email is missing
chore: update pnpm-lock.yaml for auth module dependencies
refactor: extract hash logic into shared service
docs: replace stale project brief with ecom_project_master.md
```

## Breaking changes

Append `!` after the type/scope: `feat!`: `feat(auth)!: drop support for legacy tokens`.

## Branch flow

```
feature/*  ->  dev  ->  main
```

Merge strategy: squash `feature/*` into `dev`, merge-commit `dev` into `main`.
`GIT_WORKFLOW.md` explains why, and records the branch-protection settings that
enforce it.

## PR merges

| From | To | Method |
|---|---|---|
| `feature/*` | `dev` | squash — the squashed message becomes the merge title |
| `dev` | `main` | merge commit |

Squashing is correct for a short-lived feature branch and wrong for a
long-lived integration branch. `dev` is worked on continuously, so squash-merging
it into `main` leaves the two historically unrelated and makes promotions
conflict for no reason. `GIT_WORKFLOW.md` covers this, along with the review
requirement, CI, and the branch-protection settings.

## Scope rule

Do not use a scope when the change touches multiple packages or is cross-cutting. Use a scope when the change is confined to one module.
