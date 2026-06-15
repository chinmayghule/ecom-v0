# E-Commerce Platform (ecom-v0)

## What This Is

A full-stack e-commerce platform demonstrating end-to-end software engineering — NestJS backend with JWT+RBAC auth, product catalog, cart, orders, and checkout, consumed by a Next.js frontend with typed API client. Designed as an employability portfolio project with production-quality patterns: migrations-based schema management, structured logging, CI/CD, auto-generated API docs, and a documentation site.

## Core Value

A complete, deployed, demoable e-commerce system that proves full-stack competence — auth, catalog, cart, checkout, frontend, deployment, and documentation all working together.

## Current Milestone: v2.0 Complete Monolith

**Goal:** Complete everything remaining from Phase 1 of the master plan — all backend modules (product catalog, cart, orders, addresses, seller/admin features), database seeds, OpenAPI/Swagger docs, TypeDoc + Starlight documentation site, Pino logging with BetterStack, Next.js frontend with orval typed client, CI/CD via GitHub Actions, and deploy on free-tier infrastructure.

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

- Payment integration — deferred to v3.0
- Massive seed data (50k products, 10k users) — Phase 2
- Load testing with k6 — Phase 2
- Nuxt.js frontend — Phase 3
- Angular frontend — Phase 3
- Microservices decomposition — Phase 4
- AI features — Post Phase 5 only

## Context

Brownfield project. Auth module (JWT+RBAC, session management, password reset, policy-based authorization) is complete with 101 unit + 30 E2E tests at >96% coverage. All entity definitions exist. An initial migration exists. Security review found critical gaps (plaintext refresh tokens, no rotation) that must be fixed before building new features.

The project follows a monolith architecture through Phase 3. Deploy target changed from AWS (per master plan) to free-tier: Vercel + Render + Neon.

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
| No payment in v2.0 | Reduces scope, payment is complex | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-15 after milestone v2.0 initialization*
