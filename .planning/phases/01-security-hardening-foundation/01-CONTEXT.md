# Phase 01: Security Hardening & Foundation - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix critical security gaps from the auth review (refresh token hashing/rotation, reset token optimization, CSRF, brute force, password strength, policy audit) and add foundational infrastructure (Pino structured logging, health endpoint, Resend email integration).

</domain>

<decisions>
## Implementation Decisions

### Brute Force Protection (REQ-SEC-05)
- **D-01:** DB-based lockout using a new `login_attempts` table (not in-memory — survives restarts, no Redis dependency)
- **D-02:** 5 failed attempts triggers temporary lockout; lockout duration is 15 minutes (counter resets automatically after expiry)
- **D-03:** Lockout scoped per-user (not per-IP) — standard pattern

### Token Hashing (REQ-SEC-01, REQ-SEC-03)
- **D-04:** SHA-256 for both refresh tokens (stored in `sessions` table) and reset tokens (stored in `reset_tokens` table)
- **D-05:** Rationale: Argon2 is for low-entropy secrets (passwords); SHA-256 is correct for high-entropy random tokens. Refresh tokens validated on every request — SHA-256 avoids unnecessary CPU cost without security loss.
- **D-06:** No token stored as plaintext in the database ("no token stored naked")

### CSRF Protection (REQ-SEC-04)
- **D-07:** (Deferred to implementation discussion — standard csrf-csrf library or SameSite approach)

### Password Strength Validation (REQ-SEC-06)
- **D-08:** (Deferred to implementation discussion — complexity rules vs zxcvbn)

### Pino Structured Logging (REQ-FND-01)
- **D-09:** Log level: `trace` in development, `info` in production
- **D-10:** Request logging via `pino-http` middleware — log all requests (method, URL, status, response time), exclude health endpoint path to reduce noise
- **D-11:** PII redaction — standard fields: password, token, authorization, cookie, secret

### Health Endpoint (REQ-FND-02)
- **D-12:** Full status page response — checks: DB connectivity (SELECT 1), server uptime, memory usage, last migration run
- **D-13:** No sensitive environment variable values exposed (e.g., show key names but hide values)

### Resend Email Integration (REQ-FND-03)
- **D-14:** EmailService abstraction (interface + ResendEmailService implementation) for testability and provider-swapping
- **D-15:** Development fallback: log email content to console instead of sending; production sends via Resend
- **D-16:** Dedicated `.html` template file in a `templates/` directory (not hard-coded strings, not full template engine)
- **D-17:** Per-email rate limit on forgot-password: 1 request per email per 60 seconds (via @Throttle())

### Policy Audit (REQ-SEC-07)
- **D-18:** Review all 4 policy objects (ProductPolicy, OrderPolicy, CartPolicy, SellerProfilePolicy) during planning to identify gaps; fixes implemented in execution phase

### the agent's Discretion
- CSRF library choice (csrf-csrf double-submit cookie vs SameSite attr vs custom header check)
- Password strength implementation detail (complexity regex vs zxcvbn vs blacklist)
- Pino logger transport config (pretty-print in dev, JSON in prod)
- Migration for new `login_attempts` table naming/indexing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth Module (existing code to modify)
- `backend/src/auth/auth.service.ts` — Refresh token generation, reset token flow, password reset
- `backend/src/auth/session.service.ts` — Session CRUD, refresh token validation (plaintext — needs hashing)
- `backend/src/auth/reset-token.service.ts` — Reset token create/validate/markUsed
- `backend/src/auth/dto/register.dto.ts` — Current password validation (minLength: 8 only)
- `backend/src/auth/entities/reset-token.entity.ts` — Current schema (plaintext token, expiresAt, usedAt)
- `backend/src/entities/session.entity.ts` — Current schema (plaintext refreshToken column)
- `backend/src/auth/policies/base-policy.ts` — Base policy class for audit
- `backend/src/auth/policies/product.policy.ts` — Policy to audit
- `backend/src/auth/policies/order.policy.ts` — Policy to audit
- `backend/src/auth/policies/cart.policy.ts` — Policy to audit
- `backend/src/auth/policies/seller-profile.policy.ts` — Policy to audit

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` — Module structure, guards, policies
- `.planning/codebase/STACK.md` — Technology stack, env vars, dependencies
- `.planning/codebase/CONCERNS.md` — Known security gaps that this phase addresses
- `.planning/codebase/INTEGRATIONS.md` — External service patterns, env config

### Project Context
- `.planning/ROADMAP.md` — Phase requirements (REQ-SEC-01 through REQ-FND-03)
- `.planning/PROJECT.md` — Project decisions, constraints, out-of-scope items

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Argon2 hash service** (`hash.service.ts`) — Can reference for SHA-256 utility pattern (or extend with a `TokenHashService`)
- **ThrottlerGuard** — Already configured globally (100 req/60s), can use `@Throttle()` decorator for per-endpoint overrides
- **Session entity + service** — Existing session management that refresh token hashing plugs into
- **Reset token entity + service** — Existing reset token management to modify for hashing
- **Policy base class + 4 policy implementations** — Under audit, will need testing

### Established Patterns
- **TypeORM repository pattern** — All DB operations use repositories; new `login_attempts` table follows same pattern
- **NestJS module structure** — Feature modules with controller → service → repository
- **class-validator DTOs** — Password strength validation extends existing `RegisterDto`
- **Environment-based config** — Via `@nestjs/config` + ConfigService

### Integration Points
- **Auth controller** — New brute force check hooks into `login()` endpoint
- **Auth service** — `refreshAccessToken()` needs rotation logic, `forgotPassword()` needs Resend integration
- **App controller** — Replace static hello with health endpoint
- **Main.ts** — Pino logger setup replaces NestJS default logger

</code_context>

<specifics>
## Specific Ideas

- User emphasized: "no token should be stored naked in the DB" — hash ALL tokens stored in the database
- User wants a learning-first approach — explain tradeoffs in code comments and planning docs

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-Security Hardening & Foundation*
*Context gathered: 2026-06-15*
