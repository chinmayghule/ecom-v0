# Phase 01: Security Hardening & Foundation — Validation

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.6 |
| Config file | `backend/vitest.config.ts` (unit), `backend/vitest.e2e.config.ts` (E2E) |
| Quick run command | `pnpm test` (from `backend/`) |
| Full suite command | `pnpm test:cov` (from `backend/`) |

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|------------------|
| REQ-SEC-01 | TokenHashService.hash() produces deterministic SHA-256 | unit | `pnpm test -- auth/token-hash.service` |
| REQ-SEC-02 | refreshAccessToken() issues new token, old token invalidated | unit + E2E | `pnpm test -- auth/auth.service` |
| REQ-SEC-03 | Reset token used SHA-256, single-use via usedAt, direct lookup | unit | `pnpm test -- reset-token.service` |
| REQ-SEC-05 | 5 failed attempts locks account for 15 min | unit + E2E | `pnpm test -- auth/brute-force` |
| REQ-SEC-06 | zxcvbn score < 3 rejects weak password | unit | `pnpm test -- auth/validators` |
| REQ-FND-01 | Pino logger redacts sensitive fields | unit | `pnpm test -- app.module` |
| REQ-FND-02 | /health returns DB status, uptime, memory | E2E | `pnpm test:e2e` |
| REQ-FND-03 | DevEmailService logs instead of sending | unit | `pnpm test -- email` |
| REQ-SEC-07 | Policy gaps fixed (null user, canCreate, canCancel) | unit | `pnpm test -- policies` |

## Sampling Rate

- **Per task commit:** `pnpm test`
- **Per wave merge:** `pnpm test:cov`
- **Phase gate:** Full suite green before `/gsd-verify-work`

## Test Files to Create

- [ ] `backend/src/auth/__tests__/token-hash.service.spec.ts` — covers REQ-SEC-01
- [ ] `backend/src/auth/__tests__/brute-force.service.spec.ts` — covers REQ-SEC-05
- [ ] `backend/src/auth/__tests__/validators/is-strong-password.spec.ts` — covers REQ-SEC-06
- [ ] `backend/src/email/__tests__/email.service.spec.ts` — covers REQ-FND-03
- [ ] `backend/src/health/__tests__/health.service.spec.ts` — covers REQ-FND-02
- [ ] `backend/src/auth/__tests__/session.service.spec.ts` — covers REQ-SEC-01 (updated)
- [ ] `backend/src/auth/__tests__/auth.service.spec.ts` — covers REQ-SEC-02 (updated)
- [ ] `backend/src/auth/policies/__tests__/product-policy-extended.spec.ts` — covers REQ-SEC-07
- [ ] `backend/src/auth/policies/__tests__/order-policy-extended.spec.ts` — covers REQ-SEC-07

## Validation Gates

| Gate | Condition | Blocking? |
|------|-----------|-----------|
| Unit tests | All pass | Yes |
| E2E tests | All pass | Yes |
| Coverage | >= 80% (lines, functions, branches, statements) | Yes |
| Build | `pnpm build` succeeds | Yes |
| Lint | `pnpm lint` succeeds | Yes |
| Migration | `pnpm migration:generate` + `pnpm migration:run` succeed | Yes |
