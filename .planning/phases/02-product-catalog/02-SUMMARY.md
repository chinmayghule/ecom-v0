# Phase 02: Product Catalog - Summary

**Status:** complete
**Merged:** PR #12 (`2f08c4e`) — "feat(catalog): products and categories, with the ownership rules enforced"
**Recorded:** 2026-10-10 (retroactively — see `02-CONTEXT.md` for the rebuild note)

## What Was Built

The product catalog surface: categories CRUD, products CRUD, paginated listing, and
search — with seller ownership enforced in the service layer rather than only at the
route guard.

`backend/src/catalog/` shipped as a new module (2,903 insertions across 20 files):

- **Module + service** — `catalog.module.ts`, `catalog.service.ts`
- **Controllers** — `products.controller.ts`, `categories.controller.ts`
- **DTOs** — create/update for both entities, a paginated list query, and response DTOs
- **Guard** — `optional-jwt-auth.guard.ts`

## What Was Verified

Automated coverage at merge: **364 unit**, **53 integration**, **34 E2E** tests.
Branch coverage 87.23%, function coverage 81.57%.

- `catalog.service.spec.ts` (693 lines) — business logic and ownership enforcement
- `catalog.controller.spec.ts` — route wiring and role metadata
- `catalog.dto.spec.ts` + `catalog.dto.validation.spec.ts` — DTO shape and validation
- `optional-jwt-auth.guard.spec.ts` — the optional-auth branch behaviour
- `catalog.integration.spec.ts` (534 lines) — against a real Postgres

CI ran lint, build, unit, integration, and the migration check on the PR and passed.

## Route Surface

| Route | Auth |
|---|---|
| `GET /categories` | Public |
| `GET /categories/:id` | Public |
| `POST /categories` | Admin |
| `PATCH /categories/:id` | Admin |
| `GET /products` | Optional (seller sees own drafts) |
| `GET /products/:id` | Optional |
| `POST /products` | Seller, Admin |
| `PATCH /products/:id` | Seller (own), Admin |
| `DELETE /products/:id` | Seller (own), Admin |

## Notable Decisions

1. **Optional auth on catalog reads** — storefront stays browsable anonymously, but a
   signed-in seller sees their own drafts. Handled by `OptionalJwtAuthGuard` rather
   than forcing auth on every read.
2. **Products default to `isLive: false`** — sellers need a draft state; defaulting to
   published would turn every draft save into a create-then-PATCH.
3. **Ownership enforced in the service layer**, not only at the guard — a seller passes
   the role check but still cannot mutate another seller's product.

## Carried Forward

- **Authentication is fail-open.** `JwtAuthGuard` is applied per-route, so omitting
  `@UseGuards` yields a public route. `@Public()` is inert — no guard reads its
  metadata. Recommend binding the guard globally and making `@Public()` the real
  opt-out during Phase 6, when every route gets re-read for API documentation.
- **No UAT record.** Automated coverage is strong, but nobody walked the storefront as
  a user. Phase 7 is the natural point to verify this path end to end.

See `02-CONTEXT.md` for full detail.
