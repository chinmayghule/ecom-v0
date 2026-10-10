# Directory Structure

**Analysis Date:** 2026-06-15

## Repository Layout

```
ecom-v0/
├── backend/               # NestJS monolith (TypeScript)
│   ├── src/
│   │   ├── main.ts                 # Application entry point
│   │   ├── app.module.ts           # Root module
│   │   ├── app.controller.ts       # Health endpoint
│   │   ├── app.service.ts          # Health logic
│   │   ├── data-source.ts          # TypeORM CLI / DataSource config
│   │   ├── auth/                   # Auth & authorization feature
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   └── jwt.strategy.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   ├── roles.guard.ts
│   │   │   │   ├── policies.guard.ts
│   │   │   │   ├── refresh-token.guard.ts
│   │   │   │   └── __tests__/
│   │   │   │       └── refresh-token.guard.spec.ts
│   │   │   ├── decorators/
│   │   │   │   ├── current-user.decorator.ts
│   │   │   │   ├── roles.decorator.ts
│   │   │   │   ├── public.decorator.ts
│   │   │   │   └── check-policies.decorator.ts
│   │   │   ├── policies/
│   │   │   │   ├── index.ts
│   │   │   │   ├── base-policy.ts
│   │   │   │   ├── product.policy.ts
│   │   │   │   ├── order.policy.ts
│   │   │   │   ├── cart.policy.ts
│   │   │   │   ├── seller-profile.policy.ts
│   │   │   │   └── __tests__/
│   │   │   │       ├── product-policy.spec.ts
│   │   │   │       ├── order-policy.spec.ts
│   │   │   │       ├── cart-policy.spec.ts
│   │   │   │       └── seller-profile-policy.spec.ts
│   │   │   ├── interfaces/
│   │   │   │   └── policy-handler.interface.ts
│   │   │   ├── dto/
│   │   │   │   ├── register.dto.ts
│   │   │   │   ├── login.dto.ts
│   │   │   │   ├── refresh.dto.ts
│   │   │   │   ├── forgot-password.dto.ts
│   │   │   │   ├── reset-password.dto.ts
│   │   │   │   └── session-response.dto.ts
│   │   │   ├── entities/
│   │   │   │   └── reset-token.entity.ts
│   │   │   ├── hash.service.ts
│   │   │   ├── session.service.ts
│   │   │   ├── reset-token.service.ts
│   │   │   └── __tests__/
│   │   │       ├── auth.service.spec.ts
│   │   │       ├── hash.service.spec.ts
│   │   │       ├── session.service.spec.ts
│   │   │       ├── reset-token.service.spec.ts
│   │   │       └── register.dto.spec.ts
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.service.ts
│   │   │   └── __tests__/
│   │   │       └── users.service.spec.ts
│   │   ├── entities/
│   │   │   ├── index.ts
│   │   │   ├── user.entity.ts
│   │   │   ├── product.entity.ts
│   │   │   ├── category.entity.ts
│   │   │   ├── order.entity.ts
│   │   │   ├── order-item.entity.ts
│   │   │   ├── cart.entity.ts
│   │   │   ├── cart-item.entity.ts
│   │   │   ├── address.entity.ts
│   │   │   ├── seller-profile.entity.ts
│   │   │   ├── inventory.entity.ts
│   │   │   └── session.entity.ts
│   │   └── migrations/
│   │       ├── 1780482709590-CreateAllTables.ts
│   │       └── 1780560505148-AddSessionColumns.ts
│   ├── test/
│   │   ├── setup.e2e.ts
│   │   ├── app.e2e-spec.ts
│   │   └── auth.e2e-spec.ts
│   ├── migrations/           # Auto-generated migration output
│   ├── dist/                 # Build output
│   ├── coverage/             # Coverage reports
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── vitest.e2e.config.ts
├── frontend/               # Next.js (planned, empty)
│   └── .gitkeep
├── shared/                 # Shared types (planned, empty)
│   └── .gitkeep
├── .env                    # Dev environment variables
├── .env.example            # Environment template
├── .env.local              # Local secrets (gitignored)
├── .env.test               # Test environment
├── docker-compose.yml      # PostgreSQL + pgweb
├── package.json            # Root workspace config
├── pnpm-workspace.yaml     # Workspace definition
├── biome.json              # Linting config
├── lefthook.yml            # Git hooks
├── AGENTS.md               # Agent instructions
├── COMMIT_STYLE.md         # Commit conventions
└── ecom_project_master.md  # Project brief
```

## Key File Paths

| Location | Purpose |
|----------|---------|
| `backend/src/main.ts` | HTTP server bootstrap |
| `backend/src/app.module.ts` | Root module, global providers |
| `backend/src/data-source.ts` | CLI DataSource for migrations |
| `backend/src/auth/` | Full auth feature (module, guards, policies, DTOs) |
| `backend/src/entities/` | All domain entities (shared kernel) |
| `backend/src/migrations/` | TypeORM migration files |
| `backend/src/auth/guards/` | Auth guards (JWT, Roles, Policies, Refresh) |
| `backend/src/auth/policies/` | Policy-based authorization handlers |
| `backend/src/auth/decorators/` | Custom decorators (@Roles, @Public, etc.) |
| `backend/src/auth/dto/` | Request/response DTOs |
| `backend/test/` | E2E test suites |

## Naming Conventions

- **Files:** `kebab-case` for source files (e.g., `jwt.strategy.ts`, `auth.module.ts`, `reset-token.service.ts`), `snake_case` for specs (e.g., `auth.service.spec.ts`)
- **Classes:** PascalCase (e.g., `AuthService`, `JwtAuthGuard`, `UserRole`)
- **Decorators:** PascalCase with `@` prefix (e.g., `@Roles`, `@Public`, `@CurrentUser`)
- **Entities:** PascalCase, table names in snake_case (e.g., `User` → `users`)

## Test Proximity

Tests live next to their source code in `__tests__/` directories:
- `src/auth/__tests__/` — Auth unit tests
- `src/auth/guards/__tests__/` — Guard unit tests
- `src/auth/policies/__tests__/` — Policy unit tests
- `src/users/__tests__/` — Users unit tests
- `test/` — E2E tests (separate directory)

---

*Structure analysis: 2026-06-15*