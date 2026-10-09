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

## PR merges

Squash-merge into **`dev`**. The squashed commit message becomes the merge title.

Feature branches target `dev`; `main` is fed from `dev`. `origin/HEAD` points at
`main`, which is not the integration branch — do not branch from it.

## Scope rule

Do not use a scope when the change touches multiple packages or is cross-cutting. Use a scope when the change is confined to one module.
