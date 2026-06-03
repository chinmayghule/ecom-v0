# Phase 1: Auth Module & RBAC - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the authentication module (register, login, logout, token refresh, password reset) and the authorization infrastructure (RBAC guards, ownership policy objects, role decorators) that every downstream module depends on. This is the security foundation for all Phase 1 features.

</domain>

<decisions>
## Implementation Decisions

### Login Response Schema
- **D-01:** Login returns `{ accessToken }` in body only — no user profile, no `expiresIn`
- **D-02:** Refresh token is set as httpOnly cookie (never in response body) — prevents XSS theft
- **D-03:** Refresh endpoint reads the httpOnly cookie, not request body
- **D-04:** Register auto-logs in — same response shape as login (access token body + refresh cookie)
- **D-05:** Frontend uses axios interceptor: on 401, silently refresh access token via refresh cookie, retry original request

### Ownership Checks
- **D-06:** Use Policy objects per entity (ProductPolicy, OrderPolicy, CartPolicy, SellerProfilePolicy) — not a generic guard
- **D-07:** Each policy has explicit methods (`.canEdit(user, resource)`, `.canView(user, resource)`) — clean, testable, extensible
- **D-08:** Admin bypasses all ownership checks — policy methods always return `true` for admin role

### Email Verification
- **D-09:** Not in scope for Phase 1 — users register and are immediately active with no verification required

### Password Reset
- **D-10:** In scope for Phase 1 — POST /auth/forgot-password + POST /auth/reset-password flow
- **D-11:** Email sending is mocked — console.log the reset link in development
- **D-12:** Reset token has expiry (implement as JWT or DB token with TTL)

### Multi-Session Policy
- **D-13:** Multiple active sessions allowed — user can be logged in on multiple devices simultaneously
- **D-14:** Full session management endpoints: `GET /auth/sessions` (list active), `DELETE /auth/sessions/:id` (revoke one), `POST /auth/sessions/revoke-all` (log out everywhere)
- **D-15:** Session tracking includes rich device info: user agent, OS, browser, device type, last active timestamp
- **D-16:** POST /auth/logout invalidates current session only

### the agent's Discretion
- **Token lifetimes:** Access token expiry (standard 15m), refresh token expiry (standard 7d). The user's httpOnly cookie pattern is locked — specific durations are implementation details.
- **JWT signing algorithm:** HS256 with a strong secret is standard for single-service monoliths.
- **Session entity additions:** The existing `sessions` table needs `userAgent`, `ipAddress`, `deviceInfo`, `lastActiveAt` columns.
- **Reset token storage:** DB table or JWT — either is fine for Phase 1 mocked flow.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### API & Route Design
- `.scribble/api_design.md` — Full API route design with role requirements, request/response shapes, and access scopes
- `ecom_project_master.md` §3.1 — Master tech stack (Passport.js + JWT, argon2, simple RBAC)

### Existing Data Model
- `backend/src/entities/user.entity.ts` — User entity with UserRole enum (customer, seller, admin)
- `backend/src/entities/session.entity.ts` — Session entity (needs expansion for device info)
- `backend/src/entities/index.ts` — Entity barrel exports

### Existing Application Structure
- `backend/src/app.module.ts` — Module wiring pattern (TypeORM forRootAsync, ThrottlerGuard)
- `backend/src/main.ts` — Bootstrap (helmet, CORS, global ValidationPipe)
- `backend/vitest.config.ts` — Test configuration (SWC plugin, coverage thresholds)
- `backend/src/app.controller.spec.ts` — NestJS testing pattern reference

### Task Planning
- `.scribble/task-list.json` §p1-auth — Detailed auth subtask breakdown (p1-auth-1 through p1-auth-13)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **User entity:** Already has `id`, `email`, `passwordHash`, `role` (enum), `name`, `contactNumber`, soft-delete columns — ready to use
- **Session entity:** Already has `refreshToken`, `expiresAt`, `user` FK — needs device info columns added
- **TypeORM DataSource:** Migrations-based (`synchronize: false`), glob pattern for entity discovery

### Established Patterns
- **Module structure:** `AppModule` uses `forRootAsync` with `ConfigService` — follow this pattern for `AuthModule`
- **Testing:** Vitest + SWC plugin for decorator support, `Test.createTestingModule` for integration tests
- **Validation:** Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`

### Integration Points
- `AppModule` — Auth module must be imported here
- `main.ts` — Cookie parser middleware needed for refresh token cookies
- `.env` — Needs `JWT_SECRET`, `JWT_REFRESH_SECRET` (or single secret) added

</code_context>

<specifics>
## Specific Ideas

- Refresh token as httpOnly cookie is locked — this is a firm security requirement, not negotiable
- axios interceptor pattern for token refresh on 401 — frontend concern, noted for alignment
- "Log out from all devices" is a distinct endpoint, not part of standard logout

</specifics>

<deferred>
## Deferred Ideas

- **Email verification** — deferred to a later phase. Users are active on registration without verification.
- **Real email sending provider** — password reset uses `console.log` mock for Phase 1. Wire Resend/Nodemailer in a later phase.
- **Token lifetime & rotation specifics** — agent discretion for implementation details.

</deferred>

---

*Phase: 1-Auth Module & RBAC*
*Context gathered: 2026-06-03*
