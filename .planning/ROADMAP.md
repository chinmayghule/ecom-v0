# Roadmap — ecom-v0

## Milestone: Stage 1 — Complete Monolith

**Master doc mapping:** this milestone delivers **`ecom_project_master.md` → Stage 1**.

GSD runs on a finer grain than the master document. The master document defines 5
**stages**; this milestone covers Stage 1, decomposed into 11 **phases**.

> **Terminology.** "Stage" belongs to `ecom_project_master.md` and is fixed for the
> life of the project. "Phase" belongs to GSD and is re-derived whenever the master
> document changes. They are numbered differently and were renamed on 2026-10-10
> because a collision between them had already caused one wrong conclusion — see
> `ecom_project_master.md` §2.2.

**Task-level detail lives in `WORK-INVENTORY.md`.** Every outstanding unit of work
is listed there with its source and dependencies. This roadmap only groups them.

---

## Design principle for this ordering

Phases are ordered by **dependency**, not by topic. Three orderings are load-bearing:

1. **Data integrity (03) precedes checkout (06).** Transactions, FK indexes, and
   optimistic locking are what stop concurrent checkout from overselling. Building
   checkout on their absence builds the bug DI-05 exists to catch.
2. **Documentation (08) precedes the frontend (10).** orval generates the typed
   client *from* the OpenAPI spec, so the spec has to exist first.
3. **Seeds (09) precede the frontend (10).** Frontend work needs data to develop
   against, not a hand-made fixture per page.

Grouping by topic instead would put inventory next to cart and silently inherit
every unfixed integrity problem.

---

## Phase Summary

Status is marked here. Per-phase detail follows.

- [x] **Phase 1: Security Hardening & Foundation** — complete, merged #6, UAT 8/8
- [ ] **Phase 2: Product Catalog** — ◐ partial, merged #12; **next**
- [ ] **Phase 3: Data Integrity & Code Quality** — ○ not started
- [ ] **Phase 4: Cart & Addresses** — ○ not started
- [ ] **Phase 5: Orders & Checkout** — ○ not started
- [ ] **Phase 6: Seller & Admin Management** — ○ not started
- [ ] **Phase 7: API Documentation & Auth Hardening** — ○ not started
- [ ] **Phase 8: Seeds & Docker Packaging** — ○ not started
- [ ] **Phase 9: Frontend & Component Library** — ○ not started
- [ ] **Phase 10: Observability & Deployment** — ○ not started

**Progress:** 1 of 10 phases complete, 1 partial. **Next: Phase 02.**

---

## Phases

### Phase 1: Security Hardening & Foundation

**Goal:** Close the critical gaps found in the auth review — plaintext refresh
tokens, no rotation, no brute-force protection, weak-password acceptance, policy
crashes — and add the foundation infrastructure later phases depend on.

**Status:** complete — merged #6, UAT 8/8. The four CRITICAL findings from
`.review/project-2026-06-16.md` were fixed inside this phase's waves.

**Depends on:** nothing (foundation phase).

**Plans:** 4 wave plans executed.

**Success Criteria:**
1. No plaintext token in any database column; refresh and reset tokens stored as SHA-256.
2. Refreshing a token invalidates the old one.
3. Soft-deleted users cannot authenticate.
4. Reusing a refresh token drops every session, per OAuth 2.0 Security BCP.
5. 5 failed logins lock the account for 15 minutes.
6. Weak passwords rejected at registration.
7. `/health` returns DB status, uptime, and memory.
8. Logs are structured JSON with PII redacted.

---

### Phase 2: Product Catalog

**Goal:** Deliver the full catalog surface with seller ownership enforced —
pagination, search, category management, product images, and stock levels.

**Status:** ◐ **partial** — merged #12 delivered products and categories CRUD,
pagination, and correctly-escaped name search. Criteria 1–5 are met; 6–10 are
outstanding and are executed in this phase.

**Depends on:** Phase 1 (auth and policy layer).

**Plans:** no plan records for the shipped work (reconstructed in `02-CONTEXT.md`
and `02-SUMMARY.md`). The remainder is not yet planned.

**Success Criteria:**
1. Categories CRUD available to admin. *(met)*
2. Products CRUD available to admin, seller ownership enforced in the service layer. *(met)*
3. Product listing is paginated. *(met)*
4. Product search escapes LIKE wildcards correctly. *(met)*
5. A seller cannot read or mutate another seller's products. *(met)*
6. Inventory is readable and mutable through the API (CAT-01).
7. Stock cannot go negative (CAT-01).
8. Inventory changes are transactional against the product write (CAT-01, DI-02).
9. Categories support soft delete, ordering, and hierarchy (CAT-02, CAT-03).
10. Product images are handled as uploads, not bare URL strings (CAT-04).

---

### Phase 3: Data Integrity & Code Quality

**Goal:** Clear the code-review remediation backlog that was planned as 01B and
never executed, so the commerce work that follows is built on a sound data layer.

**Status:** not started. Source: `03-data-integrity-and-code-quality/03-CONTEXT.md`.

**Depends on:** nothing. Deliberately first — its output is a prerequisite for Phase 05.

**Plans:** not yet planned. 18 items (17 outstanding; CRIT-05 done), prioritised
P0 → P1 → P2 in the source CONTEXT.

**Success Criteria:**
1. Unhandled errors return structured JSON; no stack traces leak (DI-01).
2. Multi-entity writes are transactional — a failed session create rolls back the user (DI-02).
3. All FK relationships are indexed (DI-03).
4. `PoliciesGuard` no longer resolves policies through a service locator (DI-04).
5. Inventory uses optimistic locking, so concurrent checkout cannot oversell (DI-05).
6. The service layer throws domain errors, not HTTP exceptions (DI-06).
7. Dead code removed — `RefreshDto` deleted, `@Public()` resolved (CQ-01, CQ-02).
8. E2E specs are isolated and share a single bootstrap helper (CQ-03, CQ-04, CQ-05).
9. `RolesGuard` declares `CanActivate<ExecutionContext>` (CQ-06).
10. All baseline env vars validated at startup (CQ-07).
11. `tsc --noEmit` blocks commits with type errors (TL-02).
12. ~~Coverage thresholds realistic and enforced~~ — already enforced at 80% on all four metrics (TL-01 ✅).
13. Browser detection is correct — `Edge` and `Opera` no longer resolve to `Safari` (CQ-09).
14. ~~Biome `useImportType` vs TypeORM decorators~~ — already resolved (CQ-08 ✅).

---

### Phase 4: Cart & Addresses

**Goal:** Let a customer hold a basket and manage where it ships, including
carrying a guest cart across login.

**Depends on:** Phase 3 (DI-02 transactions).

**Plans:** not yet planned.

**Success Criteria:**
1. Customer can add, update, and remove cart items (COM-01).
2. Cart totals are derived server-side, never trusted from the client (COM-01).
3. A guest cart merges into the user cart on login, with a documented conflict rule (COM-01).
4. Customer can create, update, and delete saved addresses (COM-02).
5. Only the owner can read or modify a cart or an address.
6. Cart writes are transactional (DI-02).

---

### Phase 5: Orders & Checkout

**Goal:** Turn a basket into an order — the lifecycle state machine, atomic stock
decrement, and mock payment settlement.

**Depends on:** Phase 4 (basket), Phase 3 (DI-02 transactions, DI-05 optimistic locking).

**Plans:** not yet planned.

**Success Criteria:**
1. Order lifecycle is an explicit state machine; illegal transitions are rejected (COM-03).
2. Checkout validates stock and decrements inventory atomically (COM-04).
3. Concurrent checkouts for the last unit result in one success and one 409, never an oversell (COM-04, DI-05).
4. Mock payment settles the order; a payment failure leaves no partial state (COM-04).
5. A failed checkout rolls back the stock decrement (COM-04, DI-02).
6. Customer can read their own order history and no one else's (COM-03).
7. Seller can read orders containing their products (COM-03).

---

### Phase 6: Seller & Admin Management

**Goal:** Give the non-customer roles the tooling they need, and wire up the
`seller-profile` entity that has existed since the schema was written.

**Depends on:** Phase 5 (admin manages the orders checkout creates).

**Plans:** not yet planned.

**Success Criteria:**
1. Seller can read and update their own seller profile (ROLE-01).
2. Seller cannot read or update another seller's profile.
3. Admin can list, suspend, and reinstate users (ROLE-02).
4. Admin can approve or reject seller applications (ROLE-02).
5. Admin can list orders and update order status (ROLE-03).
6. Suspended users cannot authenticate.

---

### Phase 7: API Documentation & Auth Hardening

**Goal:** Make the API self-describing and the codebase self-documenting — and
fix the authentication default while every route is already under review.

**Depends on:** Phase 6 (documents every endpoint built so far).

**Plans:** not yet planned.

**Success Criteria:**
1. OpenAPI spec served at `/api`, browsable in Swagger UI (DOC-01).
2. Every endpoint carries summary, description, and typed responses (DOC-01).
3. Backend public APIs carry TSDoc annotations (DOC-02).
4. TypeDoc generates API reference output (DOC-03).
5. Starlight renders the docs site including markdown guides (DOC-04).
6. **`JwtAuthGuard` is bound globally and `@Public()` is a working opt-out**, so a
   route that forgets its guard fails closed rather than open (SEC-01).
7. The docs build runs in CI and fails the build on error.

> SEC-01 is scheduled here on purpose. Authentication is currently **fail-open**:
> `JwtAuthGuard` is applied per route, so omitting `@UseGuards` silently produces a
> public endpoint, and `@Public()` writes metadata no guard reads. Inverting this
> touches every route — doing it during the documentation pass means the route
> inventory is already built and the change is reviewed once.

---

### Phase 8: Seeds & Docker Packaging

**Goal:** Make the system reproducible and portable — a seed script with
representative data, and container packaging that runs the whole stack locally.

**Depends on:** Phase 5 (cart and order tables need representative seed volume).

**Plans:** not yet planned.

**Success Criteria:**
1. Seed script creates a known, repeatable dataset and is safe to re-run (PKG-01).
2. Seed volume is sufficient to exercise pagination and search.
3. Seed data spans multiple sellers and users, so ownership rules are testable.
4. Multi-stage `Dockerfile` produces a runnable backend image (PKG-03).
5. Docker Compose runs backend + Postgres + pgweb + Mailpit (PKG-02).
6. A fresh clone brings the stack up with one documented command.

---

### Phase 9: Frontend & Component Library

**Goal:** Deliver the user-facing product — a Next.js client over an
orval-generated typed API, with the shared component library documented.

**Depends on:** Phase 7 (OpenAPI spec — orval's input) and Phase 8 (seed data).

**Plans:** not yet planned.

**Success Criteria:**
1. Next.js App Router app builds and runs with TypeScript and Tailwind (FE-01).
2. orval generates the typed client from the OpenAPI spec (FE-02).
3. Auth flow works end to end against the real backend (FE-03).
4. Catalog browse, search, and product detail are reachable (FE-04).
5. Cart and checkout are completable in the UI (FE-05).
6. shadcn/ui component library in place (FE-06).
7. Storybook builds and documents the shared components (FE-07).
8. Playwright covers the critical user journeys (FE-08).

---

### Phase 10: Observability & Deployment

**Goal:** Ship it — BetterStack wired, CI complete, and the monolith deployed to
free-tier infrastructure.

**Depends on:** Phase 9 (deployment packages what Phase 9 builds).

**Plans:** not yet planned.

**Success Criteria:**
1. Pino logs reach BetterStack and uptime monitoring reports backend health (OPS-01).
2. `/health` is wired to the uptime monitor (OPS-06).
3. CI runs lint, build, unit, integration, E2E, and the migration check (OPS-02).
4. Backend deploys to Render from `main` (OPS-03).
5. Frontend deploys to Vercel (OPS-04).
6. Database provisioned on Neon with migrations applied (OPS-05).
7. A fresh clone and a fresh deploy are both reproducible from documentation.

---

## Out of scope for this milestone

Per `ecom_project_master.md`, carried to later stages:

- 50k products / 10k users seed volume, and k6 load testing → Stage 2
- Microservices decomposition, GCP Pub/Sub, API gateway → Stage 3
- React Native mobile client → Stage 4 (optional)
- Distributed tracing, per-service observability → Stage 5 (optional)
- Payment provider integration — deferred past Stage 1