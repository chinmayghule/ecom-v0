# Concerns

**Analysis Date:** 2026-06-15

## Technical Debt

### Empty/Cursory Service Implementations
- `src/app.service.ts` — Returns a static string `"Hello World!"` — placeholder, needs replacement
- Several entity/service modules have limited business logic (cart, order, product services not yet created)

### Frontend & Shared Packages Empty
- `frontend/` and `shared/` are placeholders (only `.gitkeep`)
- No frontend code, no shared types between backend and frontend

### Test Coverage Gaps
- Some entities have no corresponding controller/service modules
- No tests for entities or their relationships
- Policy tests exist but may not cover all edge cases

## Known Bugs

- No known bugs identified in the codebase

## Security

### Strengths
- Helmet security headers (`src/main.ts:12`)
- Argon2id password hashing (industry standard)
- HTTP-only cookies for refresh tokens
- Separate JWT secrets for access/refresh tokens
- Rate limiting (100 req/60s via ThrottlerGuard)
- Global ValidationPipe whitelists DTOs
- Soft deletes on User entity (via `@DeleteDateColumn`)
- Refresh cookie set with `sameSite: "strict"` (`src/auth/auth.controller.ts:74`)
- Brute-force lockout: 5 failed logins locks the account 15 minutes (`BruteForceService`)
- Password strength enforced at registration via `zxcvbn-ts`
- Refresh-token rotation; reuse of a spent token drops every session

### Gaps
- No email verification flow
- No HTTPS enforcement (expected at proxy layer but not documented)
- No CSRF *token* — mitigated by `sameSite: "strict"`, not by a token
- Authentication is fail-open: `JwtAuthGuard` is per-route, so a route that omits
  `@UseGuards` is public, and `@Public()` writes metadata no guard reads

## Performance

### Bottlenecks
- No caching layer (Redis, in-memory cache, etc.)
- TypeORM query logging enabled in production if `NODE_ENV !== 'test'` (`src/app.module.ts:89`)
- All entities loaded eagerly at module init via TypeOrmModule.forRoot

### Scaling Concerns
- Monolithic design limits horizontal scaling to full-stack replication
- No connection pooling configuration visible in TypeORM options

## Fragile Areas

### Migration Path Quirk
- `src/data-source.ts` uses `__dirname` globs to `src/` — breaks in CI if running from `dist/`
- AGENTS.md documents this as a known CI quirk that requires manual switching

### Path Alias / Import Consistency
- All imports use relative paths with explicit `.js` extensions (e.g., `./app.module.js`)
- Future modules must follow the same convention — easy to forget the `.js` extension

- `src/entities/index.ts` barrel export used for entity imports — maintainer overhead when adding new entities

### Dependency Graph
- `AuthModule` imports `UsersModule` — circular dependency risk if `UsersModule` ever needs auth services
- No domain events or message bus — synchronous cross-module communication only

## Monitoring & Observability

- Structured logging via Pino, with PII redaction
- `/health` returns database status, uptime, and memory
- No metrics, tracing, or APM integration
- No error tracking (Sentry, etc.)
- BetterStack not wired

## Build & Deploy

- GitHub Actions: lint, build, unit, integration, E2E, and a migration smoke check
- Multi-stage `Dockerfile` for the backend
- Not yet deployed to Render / Vercel / Neon
- No production readiness checklist

---

*Analysis date: 2026-06-15*