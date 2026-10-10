# Phase 02: Product Catalog - Context

**Status:** complete
**Merged:** PR #12 (`2f08c4e`)

> **Retroactive record.** This phase was implemented and merged without any GSD
> planning artifacts. This file was reconstructed on 2026-10-10 from the shipped
> code and the merge commit — it records the decisions that are visible in the
> implementation, not a planning conversation that never happened. Where intent
> is not recoverable from the code, it is marked as unknown rather than invented.

<domain>
## Phase Boundary

Deliver the product and category surface the rest of the system sells: categories
CRUD, products CRUD, pagination, and search — with seller ownership enforced at the
controller and policy layer.

Explicitly out of scope: cart, checkout, inventory mutation (Phase 3), and any
seller/admin tooling beyond catalog access (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Route-level authorization (opt-in, not fail-secure)
- **D-01:** `JwtAuthGuard` is applied per-route via `@UseGuards`, not bound globally.
  Write routes additionally carry `@Roles(...)`. The consequence is that
  authentication is **opt-in**: a new route that omits `@UseGuards(JwtAuthGuard)`
  is public. This is the inverse of the common NestJS convention, where a global
  guard runs everywhere and `@Public()` is the opt-out.
- **D-02:** Because of D-01, `@Public()` is currently **inert**. The decorator writes
  `IS_PUBLIC_KEY` metadata, but no guard reads it — the only globally bound guard is
  `ThrottlerGuard`. It is documentation of intent, and a trap for the next reader who
  assumes it enforces something. Verified 2026-10-10: `IS_PUBLIC_KEY` appears only in
  the decorator and in tests that assert the metadata is written.

### Public read with optional personalization
- **D-03:** `GET /products` and `GET /products/:id` are readable anonymously, but a
  signed-in seller should see their own drafts. Rather than forcing every catalog read
  behind auth, a dedicated `OptionalJwtAuthGuard` authenticates if a token is present
  and continues anonymously if it is not. This keeps the storefront browsable while
  letting the service layer resolve ownership for the caller's role.
- **D-04:** Consequence of D-03 — an invalid or expired token on a public read is
  treated as "not signed in" rather than as an error. That is the right behaviour for
  a storefront, but it means token expiry is not surfaced to anonymous callers.

### Product lifecycle
- **D-05:** New products default to `isLive: false`. Sellers need a draft state; a
  default of published would force every draft-saving flow to be create-then-PATCH and
  would risk leaking unreviewed listings. Sellers must explicitly publish.

### Ownership rules
- **D-06:** Product writes are restricted to `SELLER` and `ADMIN` roles. Ownership is
  additionally enforced in the service layer, so a seller cannot mutate another
  seller's product even though the route itself passes the role check. Categories are
  `ADMIN`-only on write and public on read.

</decisions>

<known_issues>
## Issues Carried Forward

- **ISSUE-01 — fail-open auth default (from D-01/D-02).** The safest fix is to bind
  `JwtAuthGuard` globally and make `@Public()` the actual opt-out, which also makes the
  decorator mean something. This inverts every existing route and should be done
  deliberately, not as an incidental refactor. Recommend resolving in Phase 6, when the
  API documentation pass forces every route to be re-read anyway.
- **ISSUE-02 — no UAT record.** This phase shipped without conversational acceptance
  testing. The integration suite (`catalog.integration.spec.ts`, 534 lines) covers
  behaviour, but nobody walked the storefront as a user. Phase 7 builds the UI that
  makes this path user-visible, which is the natural point to verify it end to end.

</known_issues>

<artifacts>
## What Shipped

- `backend/src/catalog/catalog.module.ts` — module wiring
- `backend/src/catalog/catalog.service.ts` — business logic, ownership enforcement
- `backend/src/catalog/products.controller.ts` — product CRUD, pagination, search
- `backend/src/catalog/categories.controller.ts` — category CRUD
- `backend/src/catalog/dto/` — create/update/list DTOs and response DTOs
- `backend/src/catalog/guards/optional-jwt-auth.guard.ts` — optional auth pattern
- Unit tests: `catalog.service.spec.ts`, `catalog.controller.spec.ts`,
  `catalog.dto.spec.ts`, `catalog.dto.validation.spec.ts`, `optional-jwt-auth.guard.spec.ts`
- Integration tests: `backend/src/integration/catalog.integration.spec.ts`

Test counts at merge: 364 unit, 53 integration, 34 E2E.
Branch coverage 87.23%, function coverage 81.57%.

</artifacts>
