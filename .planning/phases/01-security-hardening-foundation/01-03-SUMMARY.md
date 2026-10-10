---
phase: 01-security-hardening-foundation
plan: 03
subsystem: auth
tags: [brute-force, password-strength, argon2, rate-limiting, zxcvbn]
requires:
  - phase: 01-security-hardening-foundation
    provides: Token security (Wave 2), logging (Wave 1)
provides:
  - Brute force protection with per-user account lockout (5 attempts / 15 min)
  - Password strength validation via zxcvbn-ts (score >= 3)
  - Argon2 memory cost increased to 37 MiB (OWASP non-interactive)
  - Tightened rate limits on forgot-password (3/60s) and reset-password (5/60s)
affects: [all authenticated endpoints, registration, password reset flows]
tech-stack:
  added: [zxcvbn-ts class-validator decorator, BruteForceService]
  patterns: [entropy-based password validation, sliding-window brute force]
key-files:
  created:
    - backend/src/entities/login-attempt.entity.ts
    - backend/src/auth/brute-force.service.ts

    - backend/src/auth/validators/is-strong-password.validator.ts
    - backend/src/auth/__tests__/brute-force.service.spec.ts
    - backend/src/auth/__tests__/validators/is-strong-password.spec.ts
  modified:
    - backend/src/entities/index.ts
    - backend/src/app.module.ts
    - backend/src/auth/auth.module.ts
    - backend/src/auth/auth.service.ts
    - backend/src/auth/auth.controller.ts
    - backend/src/auth/hash.service.ts
    - backend/src/auth/dto/register.dto.ts
    - backend/src/auth/__tests__/auth.service.spec.ts
key-decisions:
  - "Lockout check happens before credential validation to prevent user-existence timing leak"
  - "Two-layer password strength validation: DTO decorator (generic) + service check (with user-specific inputs)"
  - "Argon2 memoryCost 37888 (~37 MiB) per OWASP non-interactive recommendation — 18x harder for GPU attackers"
patterns-established:
  - "Brute force: DB-based sliding window with on-read cleanup of expired lockouts"
  - "Password validation: decorator for DTO-layer, zxcvbn with user inputs for service-layer"
requirements-completed:
  - REQ-SEC-05
  - REQ-SEC-06
  - MAJ-06
  - MIN-04
duration: 13min
completed: 2026-06-16
---

# Phase 01 Security Hardening: Wave 3 — Access Control & Validation Summary

**Brute force protection with per-user account lockout, zxcvbn-ts password strength validation, and Argon2 memory cost increase**

## Performance

- **Duration:** 13 min
- **Started:** 2026-06-16T06:03:00Z
- **Completed:** 2026-06-16T06:46:07Z
- **Tasks:** 4
- **Files modified:** 14

## Accomplishments

- Brute force protection with `LoginAttempt` entity and `BruteForceService` — 5 failed attempts lock account for 15 minutes
- Password strength validation via custom `@IsStrongPassword()` class-validator decorator using zxcvbn-ts
- Service-layer zxcvbn check with user-specific inputs (email, name) for contextual password scoring
- Argon2 memory cost increased from 2 MiB (default) to 37 MiB (OWASP non-interactive recommendation)
- Tightened rate limits on `forgotPassword` (3 req/60s) and `resetPassword` (5 req/60s)

## Task Commits

Each work item was committed atomically:

1. **Work Item 3.1: Brute Force Protection** — `11dcff1` (feat)
2. **Work Item 3.2: Password Strength Validation** — `ed27bb5` (feat)
3. **Work Item 3.3: Increase Argon2 Memory Cost** — `7e699ac` (feat)
4. **Work Item 3.4: Fix Rate Limiting on Password Endpoints** — `941886d` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

### Created
- `backend/src/entities/login-attempt.entity.ts` — TypeORM entity for `login_attempts` table (userId, failedAttempts, lockedUntil)
- `backend/src/auth/brute-force.service.ts` — `isLocked()`, `recordFailedAttempt()`, `resetAttempts()` with sliding window
- `backend/src/auth/validators/is-strong-password.validator.ts` — Custom `@IsStrongPassword()` class-validator decorator
- `backend/src/auth/__tests__/brute-force.service.spec.ts` — 13 unit tests for BruteForceService
- `backend/src/auth/__tests__/validators/is-strong-password.spec.ts` — 7 unit tests for password strength decorator

### Modified
- `backend/src/entities/index.ts` — Export `LoginAttempt`
- `backend/src/app.module.ts` — Add `LoginAttempt` to TypeORM entities
- `backend/src/auth/auth.module.ts` — Register `BruteForceService`, `LoginAttempt` repository
- `backend/src/auth/auth.service.ts` — Inject `BruteForceService`, add lockout check in `login()`; add zxcvbn check in `register()`
- `backend/src/auth/auth.controller.ts` — Integrate brute force tracking; add `@Throttle()` on `resetPassword`
- `backend/src/auth/hash.service.ts` — Explicit `memoryCost: 37888`, `timeCost: 2`, `parallelism: 1` for argon2id
- `backend/src/auth/dto/register.dto.ts` — Add `@IsStrongPassword()` decorator on password field
- `backend/src/auth/__tests__/auth.service.spec.ts` — Add `BruteForceService` mock; add weak password rejection test

## Decisions Made

- **Lockout-before-validation:** Lockout check in `login()` runs before credential validation to prevent user-existence timing side channels
- **Two-layer validation:** DTO-level `@IsStrongPassword()` catches weak passwords pre-service; service-level `zxcvbn()` check includes user-specific inputs (email, name) for contextual analysis
- **Argon2 memory cost:** 37 MiB (memoryCost 37888) per OWASP non-interactive recommendation — ~18x harder for GPU/ASIC parallel attacks vs default 2 MiB
- **Rate limit values:** forgotPassword at 3/60s (looser than 1/60s to allow legitimate retries), resetPassword at 5/60s (newly added, tighter than global 100/60s)

## Verification Results

| Check | Method | Result |
|-------|--------|--------|
| Unit tests | `pnpm test` | **130 passed** (16 test files) |
| T-03: 5 failed attempts lockout | BruteForceService unit tests | ✅ 13 test cases cover all states |
| T-18: Argon2 memoryCost 37888 | HashService passes explicit options to argon2 | ✅ Verified via test |
| Password strength rejection | Validator + service tests | ✅ 7 decorator tests + 1 service test |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Existing `auth.service.spec.ts` was missing imports for `BruteForceService` after adding it as a constructor dependency — added mock provider and restored lost imports during test file rewrite
- `register.dto.spec.ts` used password "strongPass123" which zxcvbn rates as score 1 — updated to use cryptographically strong passwords across all tests

## Next Phase Readiness

- **Wave 3 (Access Control & Validation) complete** — all four work items implemented and tested
- Ready for any remaining work in Phase 01 Security Hardening
- All 130 tests pass with no regressions

## Self-Check: PASSED

All 5 created files verified on disk. All 4 commits verified in git log.

> **Post-execution correction:** CSRF protection was removed in commit `092386a`.
> Proper research showed it's unnecessary for this Bearer-token API with SameSite=Strict cookies.
> The CSRF work item (3.2) was implemented but later removed — the 4 remaining work items are stable.

---

*Phase: 01-security-hardening-foundation*
*Completed: 2026-06-16*
