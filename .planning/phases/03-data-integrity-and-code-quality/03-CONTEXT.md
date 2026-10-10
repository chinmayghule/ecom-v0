# Phase 01B: Data Integrity & Observability — Context

**Purpose:** Address code review findings that touch files outside Phase 01 scope. These are items from `.review/project-2026-06-16.md` that modify separate files or require schema-wide changes.

**Dependency:** Must execute AFTER Phase 01 is complete (many items depend on Phase 01 foundations being stable).

## Security Decisions

### Blacklisting Access Tokens
- **Problem**: Stateless JWTs remain valid until expiry after logout, enabling unauthorized access to private routes.
- **Decision**: Use an **In-Memory JTI Blacklist**.
- **Reasoning**: Single-instance monolith deployment; Redis would be infra bloat. Pattern is isomorphic to Redis for future scaling.
- **Implementation**:
    - Add `jti` (UUID) to Access Token payload.
    - Implement `TokenBlacklistService` using `Map<jti, expiry>`.
    - Use `@Interval` for TTL-based cleanup.
    - Update `JwtStrategy` to reject blacklisted JTIs.
    - Update `AuthService.logout` to register the JTI.

---

## Items by Priority

### P0 (Blocking — fix before feature development)

| ID | Description | Files | Estimated Effort |
|----|-------------|-------|-----------------|
| CRIT-05 | E2E test suite exists but CI never runs it | `.github/workflows/ci.yml` | 1h |
| MAJ-01 | No global exception filter — every controller must repeat try/catch | New: `src/common/filters/global-exception.filter.ts`, modify `main.ts` | 2h |
| MAJ-02 | Multi-entity writes lack DB transactions (e.g., registration creates user + session — if session fails, user persists) | `auth.service.ts`, `session.service.ts`, `users.service.ts` | 2h |
| MAJ-03 | 12 of 14 entity relationships lack FK indexes — cascading deletes may scan full tables | All entity files with relationships | 3h |
| MAJ-04 | `PoliciesGuard` uses Service Locator pattern (`moduleRef.get()`) — breaks tree-shaking and testability | `policies.guard.ts`, policy files | 2h |
| MAJ-11 | No optimistic locking on inventory — concurrent checkout could oversell | `inventory.entity.ts` | 1h |
| MAJ-13 | `hash.service.ts` and `users.service.ts` throw NestJS HTTP exceptions from service layer — breaks if reused outside HTTP context (e.g., CLI, WebSocket) | `hash.service.ts`, `users.service.ts` | 1h |

### P1 (Important — fix before public launch)

| ID | Description | Files | Estimated Effort |
|----|-------------|-------|-----------------|
| MIN-01 | `@Public()` decorator defined but never used by any guard — dead code | `public.decorator.ts` | 0.5h |
| MIN-02 | `RefreshDto` defined but never referenced — dead code | `refresh.dto.ts` | 0.25h |
| MIN-08 | `app.e2e-spec.ts` has wrong expectations (tests auth endpoints without auth state) | `test/app.e2e-spec.ts` | 0.5h |
| MIN-09 | E2E tests share mutable state (module references, DB state) — flaky when run in different orders | `test/*.e2e-spec.ts` | 1h |
| MIN-10 | No shared E2E test helper — each test file bootstraps its own NestJS app | New: `test/helpers/setup.ts` | 1h |
| MIN-11 | `RolesGuard` missing `implements CanActivate<ExecutionContext>` — TypeScript won't catch API mismatches | `roles.guard.ts` | 0.25h |
| MIN-12 | `env.validation.ts` missing `NODE_ENV`, `LOG_LEVEL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | `env.validation.ts` | 0.5h |
| MIN-13 | Biome's `useImportType` rule conflicts with TypeORM decorators (`@Column`, `@Entity`) | `biome.json` | 0.25h |
| MIN-14 | `parseDeviceInfo()` Safari detection check is fragile — matches Safari in Chrome strings | `device-info.util.ts` | 0.5h |

### P2 (Nice-to-have — fix when convenient)

| ID | Description | Files | Estimated Effort |
|----|-------------|-------|-----------------|
| MAJ-15 | Coverage thresholds are unrealistic (80%) — no code coverage tooling enforces them yet | `vitest.config.ts` | 0.25h |
| MIN-15 | No `tsc --noEmit` in pre-commit — TypeScript errors can be committed | `lefthook.yml` | 0.5h |

---

## Execution Order

1. **MAJ-01** Global exception filter (independent, all controllers benefit)
2. **MIN-11** + **MIN-12** + **MIN-13** + **MIN-14** (quick file-local fixes)
3. **MAJ-04** PoliciesGuard refactor (testability improvement)
4. **MAJ-03** FK indexes on relationships (schema change + migration)
5. **MAJ-02** DB transactions (wrap multi-entity writes)
6. **MAJ-11** Optimistic locking on inventory
7. **MAJ-13** Remove HTTP exceptions from service layer
8. **MIN-01** + **MIN-02** Dead code removal
9. **CRIT-05** CI E2E job
10. **MIN-08** + **MIN-09** + **MIN-10** E2E quality improvements
11. **MAJ-15** + **MIN-15** Tooling polish

---

## Verification

| # | Truth | How to Observe |
|---|-------|----------------|
| T-01B-01 | Global exception filter catches all unhandled errors | POST /auth/login with broken body → 500 with structured JSON, not stack trace leak |
| T-01B-02 | Multi-entity writes use transactions | Registration with invalid session fails → user is NOT created (rollback) |
| T-01B-03 | All FK relationships have indexes | `SELECT * FROM pg_indexes WHERE tablename IN ('sessions','orders',...)` — indexes present |
| T-01B-04 | CI runs E2E tests | Push to branch → GitHub Actions shows E2E job passing |
| T-01B-05 | Inventory rejects concurrent oversell | 2 concurrent orders for last item → 1 succeeds, 1 gets 409 |
| T-01B-06 | Service layer throws domain errors, not HTTP exceptions | `HashService` throws `Error`, not `BadRequestException` |
| T-01B-07 | Dead code removed | `@Public()` decorator and `RefreshDto` no longer in codebase |
| T-01B-08 | E2E tests are isolated and shareable | Running e2e tests twice produces identical results |
| T-01B-09 | `tsc --noEmit` runs pre-commit | Commit with type error → blocked by hook |
| T-01B-10 | Baseline env vars all validated | Start app without `NODE_ENV` → validation error, not cryptic runtime error |
