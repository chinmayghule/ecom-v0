# Technology Stack

**Analysis Date:** 2026-06-15

## Languages

**Primary:**
- TypeScript 5.7.3 - Backend (ES2023 target, NodeNext modules, strict mode enabled)

**Secondary:**
- JavaScript (ESM) - Config files, scripts

## Runtime

**Environment:**
- Node.js (ES Modules) - `"type": "module"` in `backend/package.json`

**Package Manager:**
- pnpm 10.33.2 - Specified in root `package.json` (`packageManager` field)
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- NestJS 11.0.1 - Backend framework (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`)
- TypeORM 0.3.29 - ORM with PostgreSQL (`@nestjs/typeorm`, `typeorm`, `pg`)

**Testing:**
- Vitest 4.1.6 - Unit and E2E test runner
- @vitest/coverage-v8 4.1.6 - V8-based coverage provider
- Supertest 7.0.0 - HTTP integration testing

**Build/Dev:**
- Nest CLI 11.0.0 - Build and scaffolding
- SWC (via unplugin-swc 1.5.9) - Fast TypeScript compilation
- tsx 4.22.4 - TypeScript execution for scripts
- ts-node 10.9.2 - TypeScript execution for TypeORM CLI
- tsconfig-paths 4.2.0 - Path alias resolution

## Key Dependencies

**Critical:**
- `@nestjs/config` 4.0.4 - Configuration management with dotenv integration
- `@nestjs/jwt` 11.0.2 - JWT authentication
- `@nestjs/passport` 11.0.5 - Passport integration
- `@nestjs/throttler` 6.5.0 - Rate limiting (100 req/60s)
- `passport-jwt` 4.0.1 - JWT strategy
- `argon2` 0.44.0 - Password hashing (Argon2id)
- `class-validator` 0.15.1 / `class-transformer` 0.5.1 - DTO validation & transformation
- `helmet` 8.1.0 - Security headers
- `cookie-parser` 1.4.7 - HTTP-only cookie parsing for refresh tokens
- `reflect-metadata` 0.2.2 - Decorator metadata for NestJS/TypeORM
- `rxjs` 7.8.1 - Reactive extensions

**Infrastructure:**
- `pg` 8.20.0 - PostgreSQL driver
- `dotenv` 17.4.2 - Environment loading (used by TypeORM CLI)

## Configuration

**Environment:**
- Root `.env` - Main development config (loaded by both `@nestjs/config` and TypeORM CLI via `dotenv`)
- `.env.test` - Test config (DATABASE_PORT=5433, NODE_ENV=test)
- `.env.example` - Template with all required variables
- `.env.local` - Local secrets (Postman API key)

**Config Loading Priority (in `src/data-source.ts` and `src/app.module.ts`):**
1. `process.cwd()/.env` (repo root)
2. `../.env` (parent directory - for when running from `backend/`)

**Required env vars (from `.env.example`):**
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`
- `BACKEND_PORT` (default 3001)
- `JWT_SECRET`, `JWT_ACCESS_EXPIRATION_MS`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRATION_MS`
- `CORS_ORIGIN` (default `http://localhost:3000`)
- `RESET_TOKEN_EXPIRATION_MS`

**Build:**
- `backend/tsconfig.json` - Target ES2023, NodeNext modules, strict mode, decorators enabled
- Output: `backend/dist/`

## Platform Requirements

**Development:**
- Node.js (version compatible with pnpm 10.x)
- Docker & Docker Compose - For PostgreSQL (5432) and pgweb UI (8081)
- pnpm 10.33.2

**Production:**
- Node.js runtime
- PostgreSQL database
- Environment variables per `.env.example`

---

*Stack analysis: 2026-06-15*