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

| # | Phase | Status |
|---|---|---|
| 01 | Security Hardening & Foundation | ✅ complete |
| 02 | Product Catalog | ◐ partial |
| 03 | Data Integrity & Code Quality | ○ not started |
| 04 | Product Catalog — inventory & images | ○ not started — rest of Phase 2 |
| 05 | Cart & Addresses | ○ not started |
| 06 | Orders & Checkout | ○ not started |
| 07 | Seller & Admin Management | ○ not started |
| 08 | API Documentation & Auth Hardening | ○ not started |
| 09 | Seeds & Docker Packaging | ○ not started |
| 10 | Frontend & Component Library | ○ not started |
| 11 | Observability & Deployment | ○ not started |

- [x] **Phase 1: Security Hardening & Foundation**
- [ ] **Phase 2: Product Catalog**
- [ ] **Phase 3: Data Integrity & Code Quality**
- [ ] **Phase 4: Product Catalog — inventory & images**
- [ ] **Phase 5: Cart & Addresses**
- [ ] **Phase 6: Orders & Checkout**
- [ ] **Phase 7: Seller & Admin Management**
- [ ] **Phase 8: API Documentation & Auth Hardening**
- [ ] **Phase 9: Seeds & Docker Packaging**
- [ ] **Phase 10: Frontend & Component Library**
- [ ] **Phase 11: Observability & Deployment**

**Progress:** 1 of 11 phases complete, 1 partial.

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

**Goal:** Deliver the product and category read/write surface with seller
ownership enforced — pagination, search, and role-correct access.

**Status:** ◐ **partial** — merged #12. Products and categories CRUD, pagination,
and correctly-escaped name search shipped and are well tested. Inventory is
**not** managed, and lands in **Phase 04** — see the note there for why it is not
simply the next phase.

**Depends on:** Phase 1 (auth and policy layer).

**Plans:** no plan records (work landed without planning artifacts; reconstructed
in `02-CONTEXT.md` and `02-SUMMARY.md`).

**Success Criteria:**
1. Categories CRUD available to admin.
2. Products CRUD available to admin, seller ownership enforced in the service layer.
3. Product listing is paginated.
4. Product search escapes LIKE wildcards correctly.
5. A seller cannot read or mutate another seller's products.
6. ~~Inventory is a managed resource~~ — **not met**; moved to Phase 04 (CAT-01).

---

### Phase 3: Data Integrity & Code Quality

**Goal:** Clear the code-review remediation backlog that was planned as 01B and
never executed, so the commerce work that follows is built on a sound data layer.

**Status:** not started. Source: `phases/01-security-hardening-foundation/01B-CONTEXT.md`.

**Depends on:** nothing. Deliberately first — its output is a prerequisite for Phase 06.

**Plans:** not yet planned. 17 items, prioritised P0 → P1 → P2 in the source CONTEXT.

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
12. Coverage thresholds are realistic and enforced (TL-01).

---

### Phase 4: Product Catalog — Inventory & Images

**Goal:** Finish the catalog. This is the **remainder of Phase 02**, not new
scope — Phase 02 shipped the CRUD surface, and this phase ships what it did not.

**Why it is not simply "Phase 02, finished" immediately:** CAT-01 makes inventory
mutable, and mutable inventory without optimistic locking is the oversell bug
(01B MAJ-11). Doing it before Phase 03 would build the defect deliberately. So
Phase 02 splits across Phase 03, and Phase 2 is not abandoned — only ordered.

**Depends on:** Phase 3 (DI-05 optimistic locking is what makes inventory safe to mutate).

**Plans:** not yet planned.

**Success Criteria:**
1. Inventory is readable and mutable through the API (CAT-01).
2. Stock cannot go negative.
3. Categories support soft delete, matching products (CAT-02).
4. Categories support ordering and hierarchy (CAT-03).
5. Product images are handled as uploads, not bare URL strings (CAT-04).
6. Inventory changes are transactional against the product write (CAT-01).

---

### Phase 5: Cart & Addresses

**Goal:** Let a customer hold a basket and manage where it ships, including
carrying a guest cart across login.

**Depends on:** Phase 4 (cart lines reference inventory), Phase 3 (DI-02 transactions).

**Plans:** not yet planned.

**Success Criteria:**
1. Customer can add, update, and remove cart items.
2. Cart totals are derived server-side, never trusted from the client.
3. A guest cart merges into the user cart on login, with a documented conflict rule.
4. Customer can create, update, and delete saved addresses.
5. Only the owner can read or modify a cart or an address.
6. Cart writes are transactional.

---

### Phase 6: Orders & Checkout

**Goal:** Turn a basket into an order — the lifecycle state machine, atomic stock
decrement, and mock payment settlement.

**Depends on:** Phase 5 (basket), Phase 3 (DI-02 transactions, DI-05 optimistic locking).

**Plans:** not yet planned.

**Success Criteria:**
1. Order lifecycle is an explicit state machine; illegal transitions are rejected.
2. Checkout validates stock and decrements inventory atomically.
3. Concurrent checkouts for the last unit result in one success and one 409, never an oversell.
4. Mock payment settles the order; a payment failure leaves no partial state.
5. A failed checkout rolls back the stock decrement.
6. Customer can read their own order history and no one else's.
7. Seller can read orders containing their products.

---

### Phase 7: Seller & Admin Management

**Goal:** Give the non-customer roles the tooling they need, and wire up the
`seller-profile` entity that has existed since the schema was written.

**Depends on:** Phase 6 (admin manages the orders checkout creates).

**Plans:** not yet planned.

**Success Criteria:**
1. Seller can read and update their own seller profile (ROLE-01).
2. Seller cannot read or update another seller's profile.
3. Admin can list, suspend, and reinstate users (ROLE-02).
4. Admin can approve or reject seller applications (ROLE-02).
5. Admin can list orders and update order status (ROLE-03).
6. Suspended users cannot authenticate.

---

### Phase 8: API Documentation & Auth Hardening

**Goal:** Make the API self-describing and the codebase self-documenting — and
fix the authentication default while every route is already under review.

**Depends on:** Phase 7 (documents every endpoint built so far).

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

### Phase 9: Seeds & Docker Packaging

**Goal:** Make the system reproducible and portable — a seed script with
representative data, and container packaging that runs the whole stack locally.

**Depends on:** Phase 6 (cart and order tables need representative seed volume).

**Plans:** not yet planned.

**Success Criteria:**
1. Seed script creates a known, repeatable dataset and is safe to re-run (PKG-01).
2. Seed volume is sufficient to exercise pagination and search.
3. Seed data spans multiple sellers and users, so ownership rules are testable.
4. Multi-stage `Dockerfile` produces a runnable backend image (PKG-03).
5. Docker Compose runs backend + Postgres + pgweb + Mailpit (PKG-02).
6. A fresh clone brings the stack up with one documented command.

---

### Phase 10: Frontend & Component Library

**Goal:** Deliver the user-facing product — a Next.js client over an
orval-generated typed API, with the shared component library documented.

**Depends on:** Phase 8 (OpenAPI spec — orval's input) and Phase 9 (seed data).

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

### Phase 11: Observability & Deployment

**Goal:** Ship it — BetterStack wired, CI complete, and the monolith deployed to
free-tier infrastructure.

**Depends on:** Phase 10 (deployment packages what Phase 10 builds).

**Plans:** not yet planned.

**Success Criteria:**
1. Pino logs reach BetterStack and uptime monitoring reports backend health (OPS-01).
2. `/health` is wired to the uptime monitor (OPS-06).
3. CI runs lint, build, unit, integration, E2E, and the migration check (OPS-02).
4. Backend deploys to Render from `main`.
5. Frontend deploys to Vercel.
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