# ecom-v0

A multi-stage engineering project that evolves from a deployed monolith through hardening into a full microservices migration. Designed to demonstrate depth across the full stack — backend, frontend, architecture, deployment, and observability.

`ecom_project_master.md` is the source of truth for scope and architecture. This README describes the plan at a glance and the current state of the build.

**Current stage:** Stage 1 of 5 — Complete Monolith (in progress)

Stages 1–3 are the core. Stages 4–5 are optional extensions.

---

## Quick Start

### Prerequisites

Node.js LTS, pnpm, Docker, a `.env` file at the repo root with database credentials. Copy `.env.example` to `.env` to get started.

All backend commands run from the `backend/` directory — this is a pnpm workspace, and the scripts live in the backend package.

### Start the database

```sh
docker compose up -d
```

Starts PostgreSQL (5432) + pgweb (8081).

### Apply migrations

```sh
cd backend && pnpm migration:run
```

### Run the API

```sh
cd backend && pnpm start:dev
```

The API serves on port 3001 (see `BACKEND_PORT` in `.env`).

### Run tests

```sh
cd backend
pnpm test              # unit tests (Vitest)
pnpm test:integration  # tests needing a real Postgres (boots one on 5433)
pnpm test:e2e          # end-to-end (spins up an isolated test DB on 5433)
pnpm test:cov          # with coverage report
```

### Test the API

`test:api` runs the committed Postman collection through [Newman](https://newman.run.postman.com/) — the same collection used in the Postman GUI. It needs the server running (`pnpm start:dev`) and, for `forgot-password`, a fresh rate-limit window.

```sh
cd backend
pnpm start:dev   # in one terminal
pnpm test:api    # in another
```

### Run in Docker

```sh
docker build -f backend/Dockerfile -t ecom-backend .   # build context must be the repo root
docker run --rm -p 3001:3001 \
  -e DATABASE_HOST=... -e DATABASE_USER=... -e DATABASE_PASSWORD=... -e DATABASE_NAME=... \
  -e JWT_SECRET=... -e JWT_REFRESH_SECRET=... -e CORS_ORIGIN=... \
  ecom-backend
```

The server refuses to start in production unless `NODE_ENV`, real secrets, matching JWT secrets, a short access-token lifetime and an explicit `CORS_ORIGIN` are all present.

---

## About

### Vision

This project exists to demonstrate that a single developer can design, build, stress-test, deploy, and evolve a real full-stack web system. It tells a coherent story across five stages:

| Stage | What it delivers | Architecture | Deployment | Status |
|---|---|---|---|---|
| 1 | Complete monolith — backend API, Next.js frontend, Storybook, database, CI/CD, deployment | Monolith (NestJS) | Render + Vercel + Neon | **Core** |
| 2 | Hardened monolith — load testing, performance diagnosis, bottleneck fixes | Monolith | Render + Vercel + Neon | **Core** |
| 3 | Microservices decomposition — independent services, async messaging, API gateway | Microservices (NestJS) | GCP Cloud Run + Pub/Sub | **Core** |
| 4 | Native mobile client — React Native via Expo against the same API | Microservices | EAS Build (free tier) | Optional |
| 5 | Production-grade microservices — distributed tracing, per-service observability | Microservices | GCP | Optional |

The architecture transforms at Stage 3 — from a single deployable NestJS app to independently deployable services (auth, catalog, orders, API gateway) communicating via GCP Pub/Sub. This transition surfaces the interesting distributed systems problems: cross-service transactions, eventual consistency, service discovery, and observability at scale.

Everything up to Stage 3 is free-tier hosted and completes the core story. Stages 4 and 5 deepen it if time allows.

### Technology Stack

**Backend** (all stages)

| Concern | Choice |
|---|---|
| Runtime | Node.js (LTS) |
| Language | TypeScript |
| Framework | NestJS |
| ORM | TypeORM (migrations-based, `synchronize: false`) |
| Auth | Passport.js, JWT (access + refresh token pair) |
| Password hashing | argon2 |
| Validation | class-validator |
| API spec | OpenAPI / Swagger (auto-generated) |
| Logging | Pino |

**Frontend** (added progressively)

| Concern | Web — Next.js (Stage 1+) | Mobile — React Native / Expo (Stage 4+, optional) |
|---|---|---|
| State management | TanStack Query | TanStack Query |
| Styling | Tailwind CSS | NativeWind |
| Forms | React Hook Form + Zod | React Hook Form + Zod |
| API client | orval (typed, auto-generated) | orval (typed, auto-generated) |
| Token storage | httpOnly cookie | `expo-secure-store` |
| E2E testing | Playwright | Maestro or Detox (Playwright cannot drive native) |

**Database**

| Concern | Choice |
|---|---|
| Database | PostgreSQL (all stages) |
| Migrations | TypeORM |
| Local GUI | pgweb |

**Infrastructure & DevOps**

| Concern | Choice |
|---|---|
| Containerization | Docker, multi-stage Dockerfiles |
| Local orchestration | Docker Compose v2 |
| CI/CD | GitHub Actions |
| Compute (Stages 1–2) | Render (free tier Web Service) |
| Database (Stages 1–2) | Neon serverless PostgreSQL |
| Frontend hosting | Vercel (free tier) |
| Compute (Stages 3–5) | GCP Cloud Run (scales to zero) |
| Messaging (Stage 3+) | GCP Pub/Sub |
| Mobile builds (Stage 4+, optional) | Expo EAS Build (free tier) |

**Observability**

| Concern | Choice |
|---|---|
| Structured logging | Pino |
| Log ingestion + uptime | BetterStack |
| Cloud monitoring | None in Stages 1–2 — BetterStack covers uptime |
| Distributed tracing (Stage 5, optional) | OpenTelemetry |

**Testing**

| Type | Tool |
|---|---|
| Unit + integration | Vitest |
| E2E API | Supertest |
| E2E frontend (Stage 1+) | Playwright |
| Component (Stage 1+) | React Testing Library |
| Load testing (Stage 2) | k6 |

**Tooling**

| Concern | Choice |
|---|---|
| Linting + formatting | Biome |
| Pre-commit hooks | Lefthook |
| Inline code docs | TSDoc |
| Docs site (Stage 1+) | TypeDoc + Starlight |

### Current implementation (Stage 1)

The backend monolith is in progress. GSD Phase 01 (security hardening and foundation)
is complete, and GSD Phase 02 (product catalog) is partially built.

**Built:**

- **Auth module** — registration, login, JWT access/refresh token rotation, multi-session management, device tracking, RBAC (`customer` / `seller` / `admin`), policy-based resource authorization, password reset with hashed single-use tokens, brute-force lockout
- **User module** — CRUD with soft-delete
- **Catalog module** — products and categories CRUD, pagination, name search, seller-ownership enforcement, optional auth so a storefront stays publicly browsable
- **Database schema** — entities for the full e-commerce domain: users, sessions, login attempts, reset tokens, products, categories, inventory, carts, orders, addresses, seller profiles
- **Foundations** — Pino structured logging, `/health` endpoint with DB connectivity, email delivery for password reset, environment validation, Argon2id password hashing at OWASP memory cost
- **Testing** — unit, integration and E2E suites across auth, users, catalog and email, wired into CI alongside lint, build, and a migration check
- **Lefthook hooks** — lint pre-commit, lint + build + test coverage pre-push
- **CI/CD** — GitHub Actions pipeline (lint, build, unit + integration + E2E tests, migration check on pull requests)

**Still to build in Stage 1:**

- Inventory management — the entity exists but nothing manages stock yet
- Cart, addresses, orders and checkout
- Seller profile and admin management surfaces
- Data-integrity pass from a code review: DB transactions, FK indexes, optimistic locking on inventory, global exception filter
- OpenAPI spec served at `/api`, TSDoc annotations, and the TypeDoc + Starlight documentation site
- Seed script, multi-stage Dockerfiles, BetterStack observability
- Next.js frontend, orval typed client, shadcn/ui and Storybook
- Deployment to Render + Vercel + Neon

Progress is tracked per GSD phase in `.planning/ROADMAP.md`. Coverage figures move as
the suite grows — CI output is the current source of truth rather than any number recorded here.

### CI/CD & Deployment Strategy

**GitHub Actions** runs lint, build, unit tests, integration tests, and a migration check on every pull request. The migration check applies, reverts and re-applies the migration chain against a throwaway database, so a migration that cannot build a schema from empty fails the build rather than a new contributor's first run.

**Lefthook** enforces the same gates locally before push — Biome lint on pre-commit, and full lint + build + test coverage on pre-push.

The monolith (Stages 1–2) deploys to Render (backend) + Vercel (frontend) + Neon (PostgreSQL), all free tier. The microservices (Stages 3–5) each get independent Cloud Run services on GCP with per-service build pipelines.
