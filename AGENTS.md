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
| `pnpm migration:generate -- -d src/data-source.ts src/migrations/<name>` | Generate migration |
| `pnpm migration:run` | Apply pending |
| `pnpm migration:revert` | Revert last |
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

1. Create/update entity → `pnpm migration:generate` → `pnpm migration:run`
2. Rollback: `pnpm migration:revert`

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

### Commit style

Follow `./COMMIT_STYLE.md` — read that file before writing any commit message. Do not infer style from prior commits.

### Adding deps

Use `pnpm add <pkg> --filter <workspace-package>` (not `npm install` or bare `pnpm add`).

### Local-only files (never commit)

**The rule:** a file belongs in git only if someone who has never touched this machine needs it to build, run, or review the project. Agent scratch, personal tooling state and secrets fail that test.

These paths are **local-only by design** and must never be committed:

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

`.env.example` is the exception — it is the shared template and is tracked. The canonical `.env` lives at the repo root (see above); `backend/.env.example` is a stale leftover and stays ignored.

**Do not add or remove entries in `.gitignore`, and do not change repo-wide conventions, without asking the repository owner.** These paths were excluded deliberately; a tool's default is not the project's decision. If an agent believes an exclusion is wrong, raise it — do not act on it.

Two guards enforce this, both reading `.gitignore` directly so they cover paths not listed in the table:

- **pre-commit `guard-ignored-tracked`** — fails if any tracked file is also gitignored (catches `git add -f`).
- **pre-commit `guard-local-only-dirs`** — fails if any directory above stops being gitignored.
- **CI** — runs `guard-ignored-tracked` on every pull request.

Override deliberately with `git commit --no-verify` only if you have already asked.

### Pre-commit

Lefthook runs `pnpm biome check --staged` plus the two local-only guards above. Failing lint or a guard violation blocks the commit.

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
