# Concerns

**Snapshot: 2026-06-15 — superseded.** This predates GSD Phase 01 (security
hardening) and Phase 02 (catalog). Several entries below no longer hold; the ones
that have been checked are corrected inline. For what is *currently* outstanding,
read `.planning/WORK-INVENTORY.md` — that is the live view. This file is a record
of what was true on that date, kept because it shows what the codebase looked like
before hardening.

## Corrections verified 2026-10-10

| Line as written | Reality |
|---|---|
| "No CSRF protection" | **False.** The refresh cookie sets `sameSite: "strict"` (`auth.controller.ts:74`), which is the deliberate CSRF control — see the comment at line 52 explaining that the reasoning is documented in code. |
| "No brute force protection beyond rate limiting" | **False.** `BruteForceService` locks an account for 15 minutes after 5 failed attempts (Phase 01, merged #6). |
| "No password strength/complexity validation" | **False.** `zxcvbn-ts` score gate at registration (Phase 01). |
| "No structured logging (console logger only)" | **False.** Pino with PII redaction (Phase 01). |
| "No health check beyond the static Hello World endpoint" | **False.** `HealthService` returns DB status, uptime, memory. |
| "No CI/CD pipeline configured" | **False.** `.github/workflows/ci.yml` runs lint, build, unit, integration, E2E, and a migration smoke check. |
| "No Dockerfile for the backend service" | **False.** Multi-stage Dockerfile committed. |

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

### Gaps
- No CSRF protection (refresh tokens in cookies could be vulnerable)
- No email verification flow
- No brute force protection on login endpoint beyond rate limiting
- No HTTPS enforcement (expected at proxy layer but not documented)
- No password strength/complexity validation in register DTO

### Open decision — frontend access token storage
The refresh token lives in an httpOnly cookie, which is correct. **Where the
access token lives in the browser is still undecided**, because there is no
frontend yet. The expected answer is memory-only (RAM), which means a page reload
requires a silent refresh — acceptable, and the reason the refresh-token cookie
exists at all.

Deciding this is a Phase 10 task. Writing it down now so it is not discovered
mid-implementation.

## Performance

### Bottlenecks
- No caching layer (Redis, in-memory cache, etc.)
- No connection pooling configuration visible in TypeORM options
- **TypeORM query logging is on outside tests** — `logging: NODE_ENV !== "test"`
  (`app.module.ts:89`). Every query is serialised to stdout in production. This is
  a real cost at volume and should be keyed off a dedicated `LOG_LEVEL`/debug flag
  rather than inverting the test environment.

### Not a bottleneck, despite being listed as one originally
`Migration synchronize: false` is a **safety setting**, not a performance problem.
It disables TypeORM's automatic schema sync, so schema changes only happen through
reviewed migrations. It was mis-filed under Bottlenecks in the 2026-06-15 snapshot
and is corrected here rather than deleted, so the mistake is not repeated.

### Scaling Concerns
- Monolithic design limits horizontal scaling to full-stack replication

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

- No metrics, tracing, or APM integration
- No error tracking (Sentry, etc.)
- BetterStack not yet wired (Phase 11)

## Build & Deploy

- No production readiness checklist
- Not yet deployed to Render / Vercel / Neon (Phase 11)

---

*Concerns analysis: 2026-06-15. Corrections verified 2026-10-10.*