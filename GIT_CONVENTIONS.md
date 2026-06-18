# Git Conventions

## Commit style

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

Squash-merge into main. The squashed commit message becomes the merge title.

## Scope rule

Do not use a scope when the change touches multiple packages or is cross-cutting. Use a scope when the change is confined to one module.

## Branch naming

Follow the [Conventional Branch](https://conventionalbranch.org/) spec — same categories as commit types (`feature/`, `fix/`, `chore/`, `release/`, etc.) followed by a kebab-case description.

```
feature/add-payment-gateway
fix/null-pointer-in-checkout
chore/upgrade-deps
release/v2.1.0
```

Do NOT use tool-specific prefixes (`gsd/`, `claude/`, etc.).
