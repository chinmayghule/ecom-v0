# Agents

This is a **pnpm monorepo** (backend, frontend, shared) for a resume-building e-commerce project.

**Authoritative project brief:** `./official_ecom_proposal.md`

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
| `pnpm test` | Jest unit tests (`src/**/*.spec.ts`) |
| `pnpm test:e2e` | E2E tests (`test/jest-e2e.json`) |
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

## Frontend (planned)

Next.js with SSR. Storybook for UI documentation. No code yet.

---

## Documentation (planned)

- TSDoc comments on all public APIs
- TypeDoc + Starlight for auto-generated docs site

---

## Conventions

### This is a learning project

If an agent sees a decision that is poor practice, a code smell, or a security issue, **flag it and explain the better approach**. The user wants to learn industry standards, not just ship code.

### Pre-commit

Lefthook runs `pnpm biome check --staged`. Failing lint blocks commit.

### Adding deps

Use `pnpm add <pkg> --filter <workspace-package>` (not `npm install` or bare `pnpm add`).
