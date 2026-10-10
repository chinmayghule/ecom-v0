# E-Commerce Platform (ecom-v0)

## What This Is

A full-stack e-commerce platform demonstrating end-to-end software engineering — NestJS backend with JWT+RBAC auth, product catalog, cart, orders, and checkout, consumed by a Next.js frontend with typed API client. Designed as an employability portfolio project with production-quality patterns: migrations-based schema management, structured logging, CI/CD, auto-generated API docs, and a documentation site.

## Core Value

A complete, deployed, demoable e-commerce system that proves full-stack competence — auth, catalog, cart, checkout, frontend, deployment, and documentation all working together.

## Current Milestone: Stage 1 — Complete Monolith

**Goal:** Complete everything remaining from **Stage 1** of the master document — all backend modules (catalog completion, cart, orders, addresses, seller/admin features), data integrity remediation, database seeds, OpenAPI/Swagger docs, TypeDoc + Starlight documentation site, Pino logging with BetterStack, Next.js frontend with orval typed client, CI/CD via GitHub Actions, and deploy on free-tier infrastructure.

Phase breakdown lives in `ROADMAP.md`; task-level detail in `WORK-INVENTORY.md`.

**Target features:**
- Security hardening (review fixes: refresh token hashing/rotation, reset token optimization, policy fixes)
- Product catalog module (categories CRUD, products CRUD, pagination, search)
- Cart module (items management, guest merge)
- Orders + checkout module (state machine, stock decrement, mock payment)
- Addresses and seller profile management
- Admin management (users, sellers, orders)
- Database migrations + seed data
- OpenAPI/Swagger + TSDoc documentation
- TypeDoc + Starlight documentation site
- Pino structured logging + BetterStack + /health endpoint
- Next.js frontend (orval, TanStack Query, shadcn/ui, RHF, Playwright, Storybook)
- CI/CD with GitHub Actions (multi-build, security, performance)
- Free-tier deployment (Vercel + Render + Neon)
- Resend email integration for password resets
- Postman collection sync

## Requirements

### Validated

- **AUTH-01 → AUTH-10**: Auth module (register, login, logout, token refresh, password reset, RBAC, policies, session management, device tracking) — shipped in pre-phase
- **SETUP-01 → SETUP-11**: Project scaffolding (NestJS, Biome, Lefthook, TypeORM, Vitest, scripts, Git, PAM tooling) — shipped in pre-phase
- **SCHEMA-01 → SCHEMA-03**: Database schema design (entity definitions, column specs, index strategy) — shipped in pre-phase
- **ENTITY-01 → ENTITY-12**: All entity definitions created (User, Session, Product, Category, Cart, CartItem, Order, OrderItem, Address, SellerProfile, Inventory, ResetToken) — shipped in pre-phase

### Active

(Security, product catalog, cart, orders, addresses, seller profile, admin, seeds, docs, logging, frontend, CI/CD, deployment — to be defined in REQUIREMENTS.md)

### Out of Scope

Scoped against the current master document. **Stage**, not phase — see `ROADMAP.md`.

- Payment provider integration — deferred past Stage 1
- Massive seed data (50k products, 10k users) — Stage 2
- Load testing with k6 — Stage 2
- Microservices decomposition, GCP Pub/Sub, API gateway — Stage 3
- React Native mobile client — Stage 4 (optional)
- Distributed tracing, per-service observability — Stage 5 (optional)
- AI features — post Stage 3

> **Dropped on 2026-10-10, and the reasoning is recorded rather than deleted:**
> the original list deferred "Nuxt.js frontend" and "Angular frontend" to Phase 3 and
> "Microservices decomposition" to Phase 4. The restructure in #9 reordered the plan so
> microservices comes *before* client work, and dropped the three-frontend framing
> entirely — Nuxt and Angular are no longer in the plan at all. Only Next.js ships in
> Stage 1, with React Native as the optional Stage 4.

## Context

Brownfield project. The auth module (JWT+RBAC, session management, password reset,
policy-based authorization) is complete and hardened: the critical gaps found by review
— plaintext refresh tokens, no rotation, soft-deleted users able to authenticate, a
refresh-token race — were fixed inside GSD Phase 01. All entity definitions exist, but
five domain areas (inventory, cart, order, address, seller-profile) have **entities and
no implementation**. A security review's code-quality findings remain unaddressed and are
scoped as GSD Phase 03.

The project follows a monolith architecture through Stage 2. Deploy target is free-tier:
Vercel + Render + Neon.

## Constraints

- **Tech stack**: NestJS 11 + TypeORM + PostgreSQL (backend), Next.js + Tailwind + shadcn (frontend)
- **Budget**: $0 — all services must use free tiers
- **Deployment**: Vercel (frontend), Render (backend), Neon (database)
- **No payments**: Stripe/Payment integration deferred
- **API alignment**: Endpoints/types synced between frontend and backend via orval

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Refresh token as httpOnly cookie | Prevents XSS theft of long-lived tokens | ✓ Good |
| Policy objects for ownership | Cleaner than generic guards, extensible per entity | ✓ Good |
| argon2 for hashing | Memory-hard, PHC winner, no 72-char truncation | ✓ Good |
| orval for typed frontend client | Auto-generates from OpenAPI spec, keeps frontend/backend in sync | ✓ Good |
| Vercel + Render + Neon over AWS | Free-tier requirement, simpler setup | — Pending |
| Resend for email | Generous free tier, simple API | — Pending |
| No payment in Stage 1 | Reduces scope, payment is complex | — Pending |

## Evolution

This document evolves at phase and milestone boundaries.

**After each phase completes** (on its own `feature/<NN>-<slug>` branch):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted
6. Did this phase finish something the roadmap still lists as open? → Update `ROADMAP.md`

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-10 — restored from git and reconciled with the current master document. Stage terminology throughout; Out of Scope corrected against the #9 restructure. Phase-branch workflow added.*
