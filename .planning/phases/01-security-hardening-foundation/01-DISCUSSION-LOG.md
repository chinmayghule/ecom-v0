# Phase 01: Security Hardening & Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 01-Security Hardening & Foundation
**Areas discussed:** Brute force protection, Reset token hashing, Logging & health endpoint, Resend email integration, Policy audit scope

---

## Brute Force Protection

| Option | Description | Selected |
|--------|-------------|----------|
| DB-based lockout | New login_attempts table, persists across restarts | ✓ |
| In-memory lockout | Map in service, resets on restart | |

**User's choice:** DB-based lockout
**Notes:** No Redis available, DB is natural fit for TypeORM pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| 5 attempts, 15 min lockout | Industry standard | ✓ |
| 3 attempts, 30 min lockout | Stricter | |
| 10 attempts, 5 min lockout | More lenient | |

**User's choice:** 5 attempts, 15 min lockout

---

## Reset Token Hashing

| Option | Description | Selected |
|--------|-------------|----------|
| SHA-256 | Fast hash, standard for high-entropy tokens | ✓ |
| Argon2 | Same as passwords, memory-hard | |
| Don't hash | Keep plaintext | |

**User's choice:** SHA-256
**Notes:** User initially questioned why not Argon2 for everything. Explained: Argon2 for low-entropy (passwords), SHA-256 for high-entropy (random tokens). User accepted and agreed SHA-256 for both refresh tokens AND reset tokens. Emphasized "no token stored naked in DB."

---

## Logging & Health Endpoint

| Option | Description | Selected |
|--------|-------------|----------|
| trace in dev, info in prod | Full detail dev, minimal noise prod | ✓ |
| debug everywhere | Same level all envs | |
| info everywhere | Constrained logging | |

**User's choice:** trace in dev, info in prod

| Option | Description | Selected |
|--------|-------------|----------|
| DB only | Simplest health check | |
| DB + uptime | Standard approach | |
| Full status page | DB + uptime + memory + migration | ✓ |

**User's choice:** Full status page (DB, uptime, memory, last migration). No sensitive env values exposed.

| Option | Description | Selected |
|--------|-------------|----------|
| Log all requests | pino-http middleware | ✓ |
| Errors only | Only 4xx/5xx | |
| No request logging | App-level only | |

**User's choice:** Log all requests via pino-http middleware. Exclude health path.

| Option | Description | Selected |
|--------|-------------|----------|
| Standard redaction | password, token, authorization, cookie, secret | ✓ |
| Standard + email | Also redact email | |
| Minimal | Only passwords | |

**User's choice:** Standard redaction.

---

## Resend Email Integration

| Option | Description | Selected |
|--------|-------------|----------|
| EmailService interface | Abstract + Resend implementation | ✓ |
| Direct Resend SDK | Call SDK directly | |

**User's choice:** EmailService interface pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| Log in dev | Console log in development | ✓ |
| Always send | Send via Resend in all envs | |

**User's choice:** Log to console in dev, send in production.

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-coded string | Template in service file | |
| Dedicated .html template | templates/ directory | ✓ |
| Handlebars | Template engine dependency | |

**User's choice:** Dedicated .html template file. User questioned hard-coding templates — agreed separate files are better.

| Option | Description | Selected |
|--------|-------------|----------|
| Per-email 1/60s | @Throttle() per-email limit | ✓ |
| No extra limit | Global ThrottlerGuard only | |

**User's choice:** Per-email rate limit: 1 request per email per 60 seconds.

---

## Policy Audit Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Review + fix | Audit and fix identified gaps | |
| Review only | Audit only, fix later | ✓ |

**User's choice:** Review during planning, fix during execution phase.

---

## the agent's Discretion

- CSRF library choice (csrf-csrf double-submit cookie vs SameSite attr vs custom header check)
- Password strength implementation detail (complexity regex vs zxcvbn vs blacklist)
- Pino logger transport config (pretty-print in dev, JSON in prod)
- Migration for new `login_attempts` table naming/indexing

## Deferred Ideas

None.
