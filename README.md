# ecom-v0

A multi-phase engineering project that evolves from a deployed monolith through hardening, multiple frontends, and a full microservices migration across two cloud platforms. Designed to demonstrate breadth across the full stack — backend, frontend, architecture, deployment, and observability.

**Current phase:** Phase 1 of 5 — Monolith on AWS

---

## Quick Start

### Prerequisites

Node.js LTS, pnpm, Docker, a `.env` file at the repo root with database credentials.

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
pnpm start:dev
```

The API serves on port 3001. Browse the auto-generated OpenAPI spec at `/api`.

### Run tests

```sh
pnpm test        # unit + integration (Vitest)
pnpm test:e2e    # end-to-end (spins up an isolated test DB)
pnpm test:cov    # with coverage report
```

---

## About

### Vision

This project exists to demonstrate that a single developer can design, build, stress-test, deploy, and evolve a real full-stack web system across multiple architectures and cloud providers. It tells a coherent story across five phases:

| Phase | What it delivers | Architecture | Deployment |
|---|---|---|---|
| 1 | Complete monolith — backend API, frontend, database, CI/CD, deployment | Monolith (NestJS) | AWS (EC2 + RDS) |
| 2 | Hardened monolith — load testing, performance diagnosis, bottleneck fixes | Monolith | AWS |
| 3 | Three parallel frontends — Next.js, Nuxt.js, Angular against the same API | Monolith | AWS + Vercel |
| 4 | Microservices decomposition — independent services, async messaging | Microservices (NestJS) | GCP (Cloud Run) |
| 5 | Production-grade microservices — distributed tracing, per-service observability | Microservices | GCP |

The architecture transforms at Phase 4 — from a single deployable NestJS app to independently deployable services (auth, catalog, orders, API gateway) communicating via GCP Pub/Sub. This transition surfaces the interesting distributed systems problems: cross-service transactions, eventual consistency, service discovery, and observability at scale.

### Technology Stack

**Backend** (all phases)

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

| Concern | Phase 1 (Next.js) | Phase 3 (Nuxt.js) | Phase 3 (Angular) |
|---|---|---|---|
| State management | TanStack Query | Pinia | NGRX |
| Styling | Tailwind CSS | Tailwind CSS | Angular Material |
| Forms | React Hook Form + Zod | Zod | Angular Reactive Forms |
| API client | orval (typed, auto-generated) | ofetch | HttpClient |

**Database**

| Concern | Choice |
|---|---|
| Database | PostgreSQL (all phases) |
| Migrations | TypeORM |
| Local GUI | pgweb |

**Infrastructure & DevOps**

| Concern | Choice |
|---|---|
| Containerization | Docker, multi-stage Dockerfiles |
| Local orchestration | Docker Compose v2 |
| CI/CD | GitHub Actions |
| Compute (Phases 1–3) | AWS EC2 t3.micro |
| Database (Phases 1–3) | AWS RDS PostgreSQL |
| Compute (Phases 4–5) | GCP Cloud Run (scales to zero) |
| Messaging (Phase 4+) | GCP Pub/Sub |

**Observability**

| Concern | Choice |
|---|---|
| Structured logging | Pino |
| Log ingestion + uptime | BetterStack |
| Cloud monitoring (Phases 1–3) | CloudWatch |
| Distributed tracing (Phase 5) | OpenTelemetry |

**Testing**

| Type | Tool |
|---|---|
| Unit + integration | Vitest |
| E2E API | Supertest |
| E2E frontend (Phase 1+) | Playwright |
| Component (Phase 1+) | React Testing Library |
| Load testing (Phase 2) | k6 |

**Tooling**

| Concern | Choice |
|---|---|
| Linting + formatting | Biome |
| Pre-commit hooks | Lefthook |
| Inline code docs | TSDoc |
| Docs site (Phase 1+) | TypeDoc + Starlight |

### Current implementation (Phase 1)

The backend monolith is in progress with the following complete:

- **Auth module** — registration, login, JWT access/refresh token rotation, multi-session management, device tracking, RBAC (`customer` / `seller` / `admin`), policy-based resource authorization, password reset with opaque argon2-hashed tokens
- **User module** — CRUD with soft-delete
- **Database schema** — entities for the full e-commerce domain: users, sessions, products, categories, inventory, carts, orders, addresses, seller profiles
- **Testing** — 101 unit tests, 30 E2E tests across 14 test files; function coverage >96%
- **Lefthook hooks** — lint pre-commit, lint + build + test coverage pre-push
- **CI/CD** — GitHub Actions pipeline

Still to build in Phase 1: product catalog endpoints, cart & checkout flow, Next.js frontend, API documentation site with TypeDoc + Starlight, BetterStack observability, AWS deployment.

### CI/CD & Deployment Strategy

**GitHub Actions** runs lint, tests, and build on every push. **Lefthook** enforces the same gates locally before push — Biome lint on pre-commit, and full lint + build + test coverage on pre-push.

The monolith (Phases 1–3) deploys via Docker Compose on an EC2 t3.micro, with an RDS PostgreSQL instance behind it. The microservices (Phases 4–5) each get independent Cloud Run services on GCP with per-service build pipelines.
