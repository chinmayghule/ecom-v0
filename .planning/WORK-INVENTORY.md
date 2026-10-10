# Work Inventory — Stage 1 (Complete Monolith)

**This is the de-structured view.** Every outstanding unit of work, listed flat,
with its source and its dependencies — before any grouping into phases.

`ROADMAP.md` groups these into GSD phases. Keeping the two separate means the
grouping can be re-derived when the master document changes, without losing the
task-level detail or re-deciding what work exists.

**Stage** = `ecom_project_master.md` macro-stage (Stage 1–5).
**Phase** = GSD implementation phase (`.planning/ROADMAP.md`).

---

## Status key

| | |
|---|---|
| ✅ | Done |
| ◐ | Partially done |
| ○ | Not started |

---

## A. Data integrity & code quality

Source: `01-security-hardening-foundation/01B-CONTEXT.md`, itself from
`.review/project-2026-06-16.md`. **Never executed** — it has a CONTEXT but no
PLAN or SUMMARY. Verified against the codebase 2026-10-10.

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| DI-01 | Global exception filter — every controller repeats try/catch today | ○ | — |
| DI-02 | DB transactions for multi-entity writes — registration creates user + session with no rollback | ○ | — |
| DI-03 | FK indexes — **10 of 12 entities have none** (only `login-attempt`, `session` do) | ○ | — |
| DI-04 | `PoliciesGuard` service locator (`moduleRef.get()`) — hurts testability and tree-shaking | ○ | — |
| DI-05 | Optimistic locking on inventory — concurrent checkout can oversell | ○ | DI-02 |
| DI-06 | Service layer throws NestJS HTTP exceptions — breaks outside an HTTP context | ○ | — |
| CQ-01 | `@Public()` is inert — writes metadata no guard reads. Either make it real or delete it | ◐ | — |
| CQ-02 | `RefreshDto` defined but never referenced | ○ | — |
| CQ-03 | `app.e2e-spec.ts` tests auth endpoints without auth state | ○ | — |
| CQ-04 | E2E specs share mutable state — order-dependent flakes | ○ | CQ-05 |
| CQ-05 | No shared E2E helper — each file bootstraps its own app | ○ | — |
| CQ-06 | `RolesGuard` lacks `implements CanActivate<ExecutionContext>` | ○ | — |
| CQ-07 | `env.validation.ts` missing `NODE_ENV`, `LOG_LEVEL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | ○ | — |
| CQ-08 | Biome `useImportType` conflicts with TypeORM decorators | ○ | — |
| CQ-09 | `parseDeviceInfo()` Safari detection matches Safari inside Chrome strings | ○ | — |
| TL-01 | Coverage thresholds unrealistic and unenforced | ○ | — |
| TL-02 | No `tsc --noEmit` in pre-commit | ○ | — |

> **CQ-01 is already known to be a security problem, not just dead code.** See
> §E below — `@Public()` becomes load-bearing once auth is global.

---

## B. Catalog completion

The catalog module shipped in Phase 02 and is solid for what it covers: product
and category CRUD, pagination, correctly-escaped name search, seller ownership
enforcement. What is missing:

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| CAT-01 | **Inventory is unmanaged.** `Inventory` entity exists; no controller, service, or route. Stock cannot be read or changed | ○ | DI-05 |
| CAT-02 | No `deleteCategory` — products have `softDeleteProduct`, categories have no delete path | ○ | — |
| CAT-03 | No category ordering or hierarchy (`sortOrder`, `parentId` both absent) | ○ | — |
| CAT-04 | `imageUrl` is a bare string — no upload or storage handling | ○ | — |

---

## C. Commerce domain

Five domain areas have entities and **zero implementation** — no module, no
controller, no service.

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| COM-01 | Cart + CartItem — item management, guest-to-user merge on login | ○ | CAT-01 |
| COM-02 | Address — CRUD for the shipping address book | ○ | — |
| COM-03 | Order + OrderItem — lifecycle state machine | ○ | COM-01, COM-02 |
| COM-04 | Checkout — atomic stock decrement, mock payment settlement | ○ | COM-03, DI-02, DI-05 |

---

## D. Role surfaces

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| ROLE-01 | SellerProfile module — entity exists, nothing manages it | ○ | — |
| ROLE-02 | Admin: user and seller management | ○ | — |
| ROLE-03 | Admin: order management | ○ | COM-03 |

---

## E. Documentation & auth posture

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| DOC-01 | OpenAPI spec served at `/api`, browsable in Swagger UI | ○ | COM-04, ROLE-03 |
| DOC-02 | TSDoc annotations across the backend | ○ | DOC-01 |
| DOC-03 | TypeDoc generates API reference output | ○ | DOC-02 |
| DOC-04 | Starlight docs site, including markdown guides | ○ | DOC-03 |
| SEC-01 | **Fix fail-open auth.** `JwtAuthGuard` is per-route, so omitting `@UseGuards` yields a public route. Bind it globally and make `@Public()` the real opt-out | ○ | DOC-01 |

> **SEC-01 is scheduled alongside the documentation pass deliberately.** That pass
> re-reads every route, which is exactly when to invert the guard ordering. Doing it
> as an incidental refactor would mean auditing every endpoint twice.
>
> The current ordering is fail-open; the common NestJS convention is fail-secure
> (global guard, `@Public()` opts out). The inversion touches every route and should
> be a conscious change with the route inventory already in hand.

---

## F. Data & packaging

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| PKG-01 | Seed script — moderate volume; 50k+ products deferred to Stage 2 | ○ | COM-03 |
| PKG-02 | Docker Compose running the full stack locally | ○ | PKG-01 |
| PKG-03 | Multi-stage Dockerfiles for backend (and frontend) | ○ | PKG-01 |

---

## G. Frontend

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| FE-01 | Next.js App Router, TypeScript, Tailwind | ○ | DOC-01, PKG-01 |
| FE-02 | orval typed API client generated from the OpenAPI spec | ○ | DOC-01 |
| FE-03 | Auth flow in the UI | ○ | FE-01, FE-02 |
| FE-04 | Catalog browse, search, product detail | ○ | FE-01 |
| FE-05 | Cart and checkout UI | ○ | FE-03, COM-04 |
| FE-06 | shadcn/ui shared component library | ○ | FE-01 |
| FE-07 | Storybook documenting the shared components | ○ | FE-06 |
| FE-08 | Playwright covering the critical journeys | ○ | FE-05 |

---

## H. Observability & deployment

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| OPS-01 | BetterStack log ingestion and uptime monitoring | ○ | PKG-03 |
| OPS-02 | CI coverage complete (partially delivered) | ◐ | — |
| OPS-03 | Deploy backend to Render | ○ | PKG-03, OPS-01 |
| OPS-04 | Deploy frontend to Vercel | ○ | FE-08 |
| OPS-05 | Provision Neon and run migrations against it | ○ | PKG-03 |
| OPS-06 | `/health` wired to the uptime monitor | ○ | OPS-01 |

---

## Counts

| Section | Total | ✅ | ◐ | ○ |
|---|---:|---:|---:|---:|
| A. Data integrity & code quality | 17 | 0 | 1 | 16 |
| B. Catalog completion | 4 | 0 | 0 | 4 |
| C. Commerce domain | 4 | 0 | 0 | 4 |
| D. Role surfaces | 3 | 0 | 0 | 3 |
| E. Documentation & auth posture | 5 | 0 | 0 | 5 |
| F. Data & packaging | 3 | 0 | 0 | 3 |
| G. Frontend | 8 | 0 | 0 | 8 |
| H. Observability & deployment | 6 | 0 | 1 | 5 |
| **Total** | **50** | **0** | **2** | **48** |

---

## Already shipped, for reference

| Phase | Work |
|---|---|
| Phase 01 — Security Hardening & Foundation | Token hashing and rotation, brute-force lockout, password strength, policy fixes, Pino logging, `/health`, email delivery. Merged #6, UAT 8/8. |
| Phase 02 — Product Catalog | Products and categories CRUD, pagination, search, ownership enforcement. Merged #12. |

The four CRITICAL findings from `.review/project-2026-06-16.md` were fixed inside
Phase 01's waves — soft-delete auth, the refresh-token race, the reset-password E2E
hash, and the missing email template — so they do not appear above. The review's
remaining findings are section A.