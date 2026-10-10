# Phase 01: Security Hardening & Foundation — Verification

## Goal-Backward Verification

### State the Goal

> Fix critical security gaps from the auth review (plaintext tokens, brute force, weak passwords, policy gaps) and add foundational infrastructure (structured logging, health endpoint, email integration) — all without breaking existing auth flows.

### Observable Truths (What must be TRUE for the goal to be achieved)

| # | Truth | How to Observe | Work Item |
|---|-------|----------------|-----------|
| T-01 | No plaintext tokens exist in any database column | Query `sessions.refreshToken` and `reset_tokens.token` — all values must be 64-character hex strings (SHA-256). INSERT a new session, verify the stored value is a hash, not the raw JWT. | 2.2, 2.3 |
| T-02 | Refreshing a token invalidates the old one | Login → extract refresh cookie → call POST /auth/refresh → call POST /auth/refresh again with old cookie → 401 Unauthorized | 2.4 |
| T-03 | 5 failed login attempts locks the account for 15 minutes | POST /auth/login with wrong password 5 times → 6th attempt returns "Account temporarily locked" | 3.1 |
| T-05 | Weak passwords are rejected on registration | POST /auth/register with `password: "password"` → 400 Bad Request | 3.3 |
| T-06 | Policy gaps are fixed | `ProductPolicy.canView(null, inactiveProduct)` returns false (previously crashed). `SellerProfilePolicy.canCreate(customer)` returns false. `OrderPolicy.canCancel(owner, 'shipped')` returns false. | 4.1 |
| T-07 | `/health` returns DB status, uptime, memory | GET /health → JSON with `database: 'ok'`, `uptime` (number), `memory` (object with heapUsed, heapTotal, rss) | 1.2 |
| T-08 | Logs are structured JSON with redacted PII | Check stdout: `/health` requests are not logged. Any log containing `password` or `token` fields shows `[REDACTED]`. Dev mode: pretty-printed. Prod mode: JSON lines. | 1.1 |
| T-09 | Password reset email sends via EmailService | Call POST /auth/forgot-password with valid email → DevEmailService logs email content. In production, Resend sends the email. `@Throttle` allows only 1 req/60s per endpoint. | 1.3 |

### Required Artifacts (What must EXIST for each truth)

| Truth | Artifact | Path | Provides |
|-------|----------|------|----------|
| T-01 | TokenHashService | `backend/src/auth/token-hash.service.ts` | `hash()`, `compare()` methods using SHA-256 |
| T-01 | Updated SessionService | `backend/src/auth/session.service.ts` | `createSession()` hashes refreshToken before store; `validateRefreshToken()` hashes before lookup |
| T-01 | Updated ResetTokenService | `backend/src/auth/reset-token.service.ts` | `create()` uses SHA-256; `validate()` does direct lookup by hashed token |
| T-02 | Updated AuthService.refreshAccessToken | `backend/src/auth/auth.service.ts` | Revokes old session, creates new session with new token |
| T-02 | Updated AuthController.refresh | `backend/src/auth/auth.controller.ts` | Sets new refreshToken cookie in response |
| T-03 | LoginAttempt entity | `backend/src/entities/login-attempt.entity.ts` | `login_attempts` table with userId, failedAttempts, lockedUntil |
| T-03 | BruteForceService | `backend/src/auth/brute-force.service.ts` | `isLocked()`, `recordFailedAttempt()`, `resetAttempts()` |
| T-03 | Updated AuthController.login | `backend/src/auth/auth.controller.ts` | Checks lockout before credentials, records failures, resets on success |
| T-05 | IsStrongPassword decorator | `backend/src/auth/validators/is-strong-password.validator.ts` | Custom `@IsStrongPassword()` class-validator decorator |
| T-05 | Updated RegisterDto | `backend/src/auth/dto/register.dto.ts` | `@IsStrongPassword()` on password field |
| T-05 | Updated AuthService.register | `backend/src/auth/auth.service.ts` | Cross-field zxcvbn check with email/name inputs |
| T-06 | ProductPolicy (fixed) | `backend/src/auth/policies/product.policy.ts` | `canView()` handles null user without crash |
| T-06 | SellerProfilePolicy (updated) | `backend/src/auth/policies/seller-profile.policy.ts` | `canCreate()` checks seller role or admin |
| T-06 | OrderPolicy (updated) | `backend/src/auth/policies/order.policy.ts` | `canCancel()` method for valid cancellation states |
| T-07 | HealthController | `backend/src/health/health.controller.ts` | `GET /health` route |
| T-07 | HealthService | `backend/src/health/health.service.ts` | DB connectivity check, uptime, memory, migrations query |
| T-07 | HealthModule | `backend/src/health/health.module.ts` | Module registration |
| T-08 | LoggerModule config | `backend/src/app.module.ts` | `LoggerModule.forRoot()` with pinoHttp, redact, autoLogging |
| T-08 | Updated main.ts | `backend/src/main.ts` | `bufferLogs: true`, `app.useLogger(app.get(Logger))` |
| T-09 | EmailService interface | `backend/src/email/interfaces/email-service.interface.ts` | `EmailOptions`, `EmailService` interface |
| T-09 | DevEmailService | `backend/src/email/dev-email.service.ts` | Console logging fallback |
| T-09 | ResendEmailService | `backend/src/email/resend-email.service.ts` | Production email sending |
| T-09 | EmailModule | `backend/src/email/email.module.ts` | Dynamic module with `EMAIL_SERVICE` provider |
| T-09 | Password reset template | `backend/src/email/templates/password-reset.html` | HTML template with `{{RESET_URL}}` placeholder |

### Required Wiring (What must be CONNECTED for each artifact to function)

| Connection | From | To | Mechanism |
|------------|------|----|-----------|
| C-01 | AuthService.forgotPassword | EmailService | `@Inject('EMAIL_SERVICE')` injected into AuthService constructor |
| C-02 | AuthModule | TokenHashService | Added to `providers: [TokenHashService]` in AuthModule |
| C-03 | SessionService | TokenHashService | Injected via constructor |
| C-04 | ResetTokenService | TokenHashService | Injected via constructor (replaces argon2) |
| C-05 | AuthController | BruteForceService | Injected via constructor |
| C-06 | main.ts | Logger (nestjs-pino) | `app.useLogger(app.get(Logger))` |
| C-07 | AppModule | HealthModule | Added to `imports` array |
| C-08 | AppModule | EmailModule.forRoot() | Added to `imports` array |
| C-09 | AppModule | LoginAttempt entity | Added to TypeOrmModule.forRootAsync `entities` array and `TypeOrmModule.forFeature([LoginAttempt])` in AuthModule |

### Key Links (Where breakage causes cascading failures)

| Link | Risk | Mitigation |
|------|------|------------|
| TokenHashService used by both SessionService and ResetTokenService | If hash() is wrong, ALL token operations break | Unit test hash deterministic, compare correct |
| AuthController.login integrates brute force + existing login flow | If lockout check is wrong, legitimate users cannot log in | Test: 4 attempts → 5th works after 15 min wait. Test: 5 rapid attempts → locked |
| AuthService.refreshAccessToken revokes session before creating new one | If creation fails AFTER revocation, user is logged out permanently | Wrap in try/catch: if new token creation fails, the user still has no session. **Acceptable** — rare failure scenario. For higher reliability, use a database transaction. |
| argon2 removal from reset-token.service.ts | If import is left, it's dead code. If removed but TokenHashService not injected, the service crashes. | The import MUST be removed. The TokenHashService injection MUST be added. |

### Key Metrics

| Metric | Good | Target |
|--------|------|--------|
| Unit tests pass (new) | All pass | 100% |
| E2E tests pass | All pass | 100% |
| Coverage maintained | >= 80% | Lines, functions, branches, statements |
| Existing auth tests still pass | All pass (no regressions) | 100% |
| Migration generates cleanly | No duplicate migration names | Single migration file |

## Installation Verification

```bash
# Install all packages
pnpm add nestjs-pino pino-http pino-pretty resend zxcvbn-ts --filter backend

# Verify packages are in package.json
grep -E 'nestjs-pino|pino-http|pino-pretty|resend|zxcvbn-ts' backend/package.json
```

## Migration Verification

```bash
# Generate migration for login_attempts table
pnpm migration:generate -- src/migrations/CreateLoginAttemptsTable

# Apply migration
pnpm migration:run
```

## Test Suite Verification

```bash
# Run unit tests (fast feedback)
pnpm test
# Expected: all tests pass, no failures

# Run with coverage (verify >= 80%)
pnpm test:cov
# Expected: lines >= 80%, functions >= 80%, branches >= 80%, statements >= 80%

# Run E2E tests (requires Docker)
pnpm test:e2e
# Expected: all security scenario tests pass
```

## Manual Verification Checklist

```bash
# 1. Health endpoint
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"...","uptime":...,"memory":{...},"database":"ok","lastMigration":"..."}

# 2. Brute force (5 failed logins)
for i in 1 2 3 4 5; do
  curl -X POST http://localhost:3001/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
# Expected: 6th attempt returns {"message":"Account temporarily locked..."}

# 3. Weak password rejected
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
# Expected: 400 Bad Request

# 4. Verify no plaintext tokens in DB
docker compose exec -it postgres psql -U ecom -d ecom -c \
  "SELECT refreshToken FROM sessions LIMIT 1;"
# Expected: 64-character hex string (not a JWT with dots)
```

## Acceptance Checklist

### Security Requirements

| ID | Description | Verification Method | Pass/Fail |
|----|-------------|-------------------|-----------|
| REQ-SEC-01 | Refresh token hashing (SHA-256, never plaintext) | DB query: `sessions.refreshToken` values are hex hashes, not JWTs | ☐ |
| REQ-SEC-02 | Refresh token rotation (new token on each refresh) | E2E: refresh twice, second call returns 401 | ☐ |
| REQ-SEC-03 | Reset token optimization (SHA-256, single-use, expiry) | Unit: TokenHashService used, direct lookup by hash, `usedAt` check | ☐ |
| REQ-SEC-05 | Brute force protection (5 attempts → 15 min lockout) | E2E: 5 failed logins locks account | ☐ |
| REQ-SEC-06 | Password strength validation (zxcvbn-ts >= score 3) | Unit: weak password rejected, strong accepted | ☐ |
| REQ-SEC-07 | Policy audit gaps fixed | Unit: null user crash fixed, canCreate, canCancel | ☐ |

### Foundation Requirements

| ID | Description | Verification Method | Pass/Fail |
|----|-------------|-------------------|-----------|
| REQ-FND-01 | Pino structured logging with PII redaction | Manual: check dev stdout for pretty-print, redacted fields | ☐ |
| REQ-FND-02 | /health endpoint with DB check | `curl /health` returns JSON with db status, uptime, memory | ☐ |
| REQ-FND-03 | Resend email integration | Dev: forgotPassword logs email. Prod: sends via Resend. Rate limited. | ☐ |

### Infrastructure Checks

| Check | Verification | Pass/Fail |
|-------|-------------|-----------|
| All packages installed | `pnpm ls -r` shows all new deps | ☐ |
| Migration generated | `ls backend/src/migrations/*CreateLoginAttempts*` exists | ☐ |
| Migration applied | `pnpm migration:run` succeeds | ☐ |
| No import errors | `pnpm build` succeeds | ☐ |
| No lint errors | `pnpm lint` succeeds | ☐ |
| Unit tests pass | `pnpm test` — all green | ☐ |
| E2E tests pass | `pnpm test:e2e` — all green | ☐ |
| Coverage maintained | `pnpm test:cov` — >= 80% all thresholds | ☐ |
| Existing auth tests not broken | All prior unit + E2E tests still pass | ☐ |
| Argon2 removed from reset-token.service.ts | `grep argon2 backend/src/auth/reset-token.service.ts` returns nothing | ☐ |
| TokenHashService injected, not argon2 | `grep TokenHashService backend/src/auth/reset-token.service.ts` has import + constructor | ☐ |

## Rollback Plan

If verification fails:

```bash
# 1. Revert last migration
pnpm migration:revert

# 2. Git revert the phase commit
git revert HEAD --no-edit

# 3. File bugs for each failed verification item
```

## Output

After verification passes, create `.planning/phases/01-security-hardening-foundation/01-SUMMARY.md` documenting:
- What was built (per work item)
- Key decisions affirmed or changed during implementation
- Any deviations from this plan with rationale
- Test results (unit, coverage, E2E)
- Remaining gaps or deferred work

> **Note:** CSRF protection (REQ-SEC-04) was initially implemented but later removed.
> The research that recommended it (01-RESEARCH.md) used session-cookie reasoning for a Bearer-token API.
> All API endpoints use `Authorization: Bearer` headers — structurally immune to CSRF.
> The `/auth/refresh` cookie has SameSite=Strict. See 01-RESEARCH.md for the correction note.
