# Agents

This is a **pnpm monorepo** (backend, frontend, shared) for a resume-building e-commerce project.

**Authoritative project brief:** `./ecom_project_master.md`

---

## Phases

Build order: `backend → frontend → CI/CD/deploy`. Monolith first, no micro-architecture.

---

## Commands

Run all commands from the package directory (`backend/`, `frontend/`, etc.), not root.

### Backend

| Command | What |
|---------|------|
| `pnpm start:dev` | Dev server (file watch) |
| `pnpm test` | Vitest unit tests (`src/**/*.spec.ts`) |
| `pnpm test:e2e` | E2E tests (`./vitest.e2e.config.ts`) |
| `pnpm test:cov` | Coverage report |
| `pnpm migration:generate src/migrations/<Name>` | Generate migration (no `--`; pnpm forwards it literally and TypeORM then sees zero path arguments) |
| `pnpm migration:run` | Apply pending |
| `pnpm migration:revert` | Revert last |
| `pnpm test:integration` | Tests that need a real Postgres (boots it on 5433) |
| `pnpm lint` | Biome check `./src` |
| `pnpm build` | `nest build` |

### Root

| Command | What |
|---------|------|
| `docker compose up -d` | Start PostgreSQL (5432) + pgweb UI (8081) |
| `pnpm biome check --staged --no-errors-on-unmatched` | Pre-commit (runs via lefthook) |

---

## Backend details

- **Stack:** Nest.js 11 + TypeORM + PostgreSQL, migrations-based (`synchronize: false`)
- **Env:** Global `.env` at repo root — loaded by both `@nestjs/config` (runtime) and `dotenv` (TypeORM CLI via `src/data-source.ts`)
- **Required env vars:** `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`
- **Global ValidationPipe:** `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- **Security:** `helmet`, CORS (`*` in dev), `ThrottlerGuard` (100 req/60s)
- **Roles:** `customer` | `seller` | `admin`

### Schema change workflow

1. Create/update entity → `pnpm migration:generate src/migrations/<Name>` → `pnpm migration:run`
2. Rollback: `pnpm migration:revert`

**A migration is immutable once it has run on any shared database.** Editing a
shipped migration is how duplicate-constraint and half-applied-schema bugs
appear. Before approving one, check it applies to an *empty* database — CI does
this on every PR against a database nothing else references.

**Name migrations for the change, not the timestamp.** `1791544704010-InitialSchema.ts`
is fine; a robotic generated name is not. The timestamp prefix is required for
ordering, the rest is yours.

**Anything whose correctness depends on SQL semantics — atomicity, `ON CONFLICT`,
foreign keys, cascade behaviour — needs an integration test in `src/integration/`.
A unit test with a mocked repository cannot observe any of it, and will pass
while the query is wrong.

### CI quirk

`src/data-source.ts` uses `__dirname` globs pointing to `src/`. In CI, change to `dist/` paths.

---

## Frontend

Next.js with App Router, TypeScript, Tailwind CSS. See `./ecom_project_master.md` for full stack decisions.

---

## Documentation (planned)

- TSDoc comments on all public APIs
- TypeDoc + Starlight for auto-generated docs site

---

## Conventions

### This is a learning project

If an agent sees a decision that is poor practice, a code smell, or a security issue, **flag it and explain the better approach**. The user wants to learn industry standards, not just ship code.

### Git conventions

| File | Covers |
|---|---|
| `./COMMIT_STYLE.md` | how a commit message is written |
| `./GIT_CONVENTIONS.md` | commit-message format and branch naming |
| `./GIT_WORKFLOW.md` | branch flow, merge strategy, review rules, CI, protection settings |
| `./GSD_WORKFLOW.md` | planning state: what is tracked, phase↔master-doc mapping, `pnpm gsd:doctor` |

**Do not add `.planning/` to `.gitignore`.** The planning record is project
documentation, not scratch, and it was lost on 2026-10-10 precisely because it
was ignored. `guard-planning-tracked` blocks this.

Never push to `origin/main`, never delete `origin/dev`, and never merge into
`origin/dev` without a human approving review — an agent-authored PR is not
self-reviewed.

Branch names follow Conventional Branch: `feature/`, `fix/`, `chore/`, `docs/`, `release/` plus a kebab-case description. No tool-specific prefixes.

### Adding deps

Use `pnpm add <pkg> --filter <workspace-package>` (not `npm install` or bare `pnpm add`).

### Local-only files (never commit)

**Rule:** a file belongs in git only if someone who has never touched this machine needs it
to build, run, or review the project.

**Do not add or remove `.gitignore` entries, or change repo-wide conventions, without asking
the repository owner.** These exclusions are deliberate; a tool's default is not the project's
decision. If you believe an exclusion is wrong, raise it — do not act on it.

Full path list, rationale, and the guards that enforce it: **`./LOCAL_ONLY_FILES.md`**
Read it before staging anything that looks like tooling state, secrets, or scratch.

### Pre-commit

Lefthook runs `pnpm biome check --staged` plus the local-only guards described in
`LOCAL_ONLY_FILES.md`. Failing lint or a guard violation blocks the commit.

---

## Postman API Collection

The Postman collection `ecom-v0` is managed at https://api.getpostman.com/collections.
**API key:** stored in `.env.local` at repo root (loaded automatically via `source`).

### Workflow

Whenever new API endpoints are added and **all tests pass**, ask the user:
> "New endpoints added. Should I sync them to the Postman collection?"

If approved:
1. Build the updated collection JSON payload (v2.1.0 schema).
2. POST to `https://api.getpostman.com/collections` with header `X-Api-Key: $(grep POSTMAN_API_KEY .env.local | cut -d= -f2)`.
3. Confirm success.
