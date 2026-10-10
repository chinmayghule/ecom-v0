# Roadmap — ecom-v0

## Milestone v2.0 — Complete Monolith

**Master doc mapping:** this milestone delivers **`ecom_project_master.md` → Phase 1 (Complete Monolith)**.

GSD runs on a finer grain than the master doc. The master doc has 5 macro-phases
(Complete Monolith → Hardened Monolith → Microservices → Mobile → Production).
This milestone covers macro-phase 1 only, decomposed into 8 implementation
phases. Master doc Phases 2–5 become later milestones, not phases here.

> **Rebuild note (2026-10-10):** the previous `ROADMAP.md` was lost — `.planning/`
> was gitignored with no backup, so it had no recovery path. This file was rebuilt
> from `ecom_project_master.md` (restructured in #9) and the git history. It is
> deliberately *not* a restoration of the old file: the old one decomposed an
> earlier draft of the master doc and predated the phase restructure, which moved
> Storybook into Phase 1 and pinned deployment to Render + Vercel + Neon.
>
> **Never ignore this directory again.** See `GSD_WORKFLOW.md`.

---

## Phase Summary

- [x] **Phase 1: Security Hardening & Foundation**
- [x] **Phase 2: Product Catalog**
- [ ] **Phase 3: Cart, Addresses & Checkout**
- [ ] **Phase 4: Seller & Admin Features**
- [ ] **Phase 5: Database Seeds & Docker Packaging**
- [ ] **Phase 6: API Documentation & Docs Site**
- [ ] **Phase 7: Frontend & Component Library**
- [ ] **Phase 8: Observability & CI/CD Deployment**

**Progress:** 2 of 8 phases complete.

---

## Phases

### Phase 1: Security Hardening & Foundation

**Goal:** Close the critical gaps found in the auth review — plaintext refresh
tokens, no token rotation, no brute-force protection, weak-password acceptance,
policy crashes — and add the foundation infrastructure (Pino logging, `/health`,
email delivery) that later phases depend on.

**Status:** complete — merged in #6, UAT 8/8 pass.

**Depends on:** nothing (foundation phase).

**Plans:** 4 wave plans executed.

**Success Criteria:**
1. No plaintext token in any database column; refresh and reset tokens stored as SHA-256.
2. Refreshing a token invalidates the old one.
3. 5 failed logins lock the account for 15 minutes.
4. Weak passwords rejected at registration (zxcvbn score < 3).
5. Policy layer handles null user, unauthorized create, and illegal cancel without crashing.
6. `/health` returns DB status, uptime, and memory.
7. Logs are structured JSON with PII redacted.
8. Password reset email delivers via EmailService (dev-mode logging or Resend).

---

### Phase 2: Product Catalog

**Goal:** Deliver the product and category read/write surface that the rest of
the system sells — categories CRUD, products CRUD, pagination, and search —
with ownership rules enforced at the policy layer.

**Status:** complete — implemented and merged in #12.

**Depends on:** Phase 1 (auth and policy layer supply ownership enforcement).

**Plans:** none recorded (work landed without planning artifacts; records added
retroactively — see `02-CONTEXT.md` and `02-SUMMARY.md`).

**Success Criteria:**
1. Categories CRUD available to admin.
2. Products CRUD available to admin, with seller ownership enforced on read and write.
3. Product listing is paginated.
4. Product search returns matching products.
5. A seller cannot read or mutate another seller's products.

---

### Phase 3: Cart, Addresses & Checkout

**Goal:** Complete the purchase path — cart item management with guest-merge,
address book management, and a checkout flow that creates an order, decrements
stock atomically, and settles through a mock payment.

**Depends on:** Phase 2 (checkout consumes products and inventory).

**Plans:** not yet planned.

**Success Criteria:**
1. Customer can add, update, and remove cart items.
2. Guest cart merges into the user cart on login.
3. Customer can create, update, and delete saved addresses.
4. Checkout validates stock atomically and fails cleanly when insufficient.
5. Checkout creates an order and decrements inventory in one transaction.
6. Mock payment settles the order; failure leaves no partial state.
7. Order state machine rejects illegal transitions.

---

### Phase 4: Seller & Admin Features

**Goal:** Give the non-customer roles the tooling they need — seller profile
management and admin management of users, sellers, and orders.

**Depends on:** Phase 3 (admin manages the orders that checkout creates).

**Plans:** not yet planned.

**Success Criteria:**
1. Seller can read and update their own seller profile.
2. Seller cannot read or update another seller's profile.
3. Admin can list, suspend, and reinstate users.
4. Admin can approve or reject seller applications.
5. Admin can list and update order status.

---

### Phase 5: Database Seeds & Docker Packaging

**Goal:** Make the system reproducible and portable — a seed script producing
realistic data, and multi-stage Docker packaging that runs the full stack locally
and builds deployable images.

**Depends on:** Phase 3 (cart and order tables need representative seed volume).

**Plans:** not yet planned.

**Success Criteria:**
1. Seed script creates a known, repeatable dataset and is safe to re-run.
2. Seed volume is sufficient to exercise pagination and search.
3. Multi-stage `Dockerfile` builds the NestJS backend and produces a runnable image.
4. Docker Compose runs backend + Postgres + pgweb.
5. Mailpit is wired for local email inspection.
6. A fresh clone can bring the stack up with one command.

---

### Phase 6: API Documentation & Docs Site

**Goal:** Make the API self-describing and the codebase self-documenting — an
OpenAPI spec served at `/api`, TSDoc annotations across the backend, and a
TypeDoc + Starlight documentation site.

**Depends on:** Phase 4 (documents every endpoint built so far).

**Plans:** not yet planned.

**Success Criteria:**
1. OpenAPI spec is served at `/api` and is browsable in Swagger UI.
2. Every controller endpoint carries a decorator with summary, description, and response types.
3. Backend public APIs carry TSDoc annotations.
4. TypeDoc generates API reference output.
5. Starlight renders the docs site including markdown guides.
6. The docs build runs in CI and fails the build on error.

---

### Phase 7: Frontend & Component Library

**Goal:** Deliver the user-facing product — a Next.js App Router frontend
consuming the backend through an orval-generated typed client, with Storybook
documenting the shared component library.

**Depends on:** Phase 5 (seed data to develop against) and Phase 6 (OpenAPI spec
is orval's input, so the typed client cannot be generated before it exists).

**Plans:** not yet planned.

**Success Criteria:**
1. Next.js app builds and runs on the App Router with TypeScript and Tailwind.
2. orval generates the typed API client from the OpenAPI spec.
3. Auth flow works end to end against the real backend.
4. Catalog browse, search, product detail, cart, and checkout are reachable in the UI.
5. shadcn/ui component library is in place and documented.
6. Storybook builds and documents the shared components.
7. Playwright covers the critical user journeys.

---

### Phase 8: Observability & CI/CD Deployment

**Goal:** Ship it — BetterStack wired for log ingestion and uptime, GitHub
Actions covering lint/build/test/migration gates, and the monolith deployed to
free-tier infrastructure (Render + Vercel + Neon).

**Depends on:** Phase 7 (deployment packages the frontend that Phase 7 builds).

**Plans:** not yet planned.

**Success Criteria:**
1. Pino logs reach BetterStack and uptime monitoring reports backend health.
2. CI runs lint, build, unit tests, integration tests, and the migration check.
3. Migration check applies, reverts, and re-applies the chain against a throwaway database.
4. Backend deploys to Render from the main branch.
5. Frontend deploys to Vercel.
6. Database is provisioned on Neon and migrations run against it.
7. `/health` is wired to the uptime monitor.

---

## Out of Scope for This Milestone

Carried forward to later milestones per `PROJECT.md`:

- Massive seed volume (50k products, 10k users) and k6 load testing → master doc Phase 2
- Microservices decomposition, GCP Pub/Sub, API gateway → master doc Phase 3
- React Native mobile client → master doc Phase 4 (optional)
- Distributed tracing, per-service observability → master doc Phase 5 (optional)
- Payment integration → v3.0
