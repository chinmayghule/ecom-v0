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

Feature branches target `dev`. `dev` is the integration branch and always
mergeable. `main` is what a deploy reads.

Promotion is `dev` -> `main` through a PR titled `chore: promote dev to main`.
Both branches are protected: PR required, CI required, linear history, no force
pushes. `main` additionally requires review conversation to be resolved.

## PR merges

Squash-merge everywhere, including into `dev`. The squashed commit message
becomes the merge title.

Squashing means the commits on `dev` are **not** ancestors of `main`. After a
promotion, `main` sits N commits "behind" `dev` with zero commits unique to it,
and `git log origin/main..origin/dev` lists every commit since the last
promotion. That is expected, not drift — compare content instead:

```sh
git diff --stat origin/main origin/dev   # empty after a promotion
```

A non-empty diff means `main` is genuinely behind and needs another promotion.

Required status checks are configured by **job name**. `main` requires
`quality`, which is the single job in `.github/workflows/ci.yml`. Renaming that
job leaves `main` permanently `BLOCKED` with no failing run to explain it,
because a check that never reports can never pass — update branch protection in
the same commit.

## Scope rule

Do not use a scope when the change touches multiple packages or is cross-cutting. Use a scope when the change is confined to one module.
