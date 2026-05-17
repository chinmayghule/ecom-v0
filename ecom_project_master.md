# E-commerce Project: Master Document

---

## 1. Purpose

This project exists for **employability**. The goal is to demonstrate that you can design, build, stress-test, deploy, and evolve a real full-stack web system — end to end, without scope collapse.

The secondary goal is to produce something that tells a coherent story across multiple resume updates: starting from a deployed monolith, progressing through hardening and multiple frontends, and culminating in a microservices architecture across two cloud platforms.

---

## 2. Terminology

Before phases and packages, the vocabulary needs to be exact.

### 2.1 Layers

Layers are the functional divisions inside the application. They exist **simultaneously** at every phase. Adding a new phase does not replace layers — it evolves them.

| Layer | What it is |
|---|---|
| **Frontend** | User-facing UI. Multiple frameworks deployed in parallel from Phase 3. |
| **Backend (API)** | Business logic, data access, authentication, authorization. NestJS throughout. |
| **Database** | Persistent storage. PostgreSQL throughout. |
| **Infrastructure** | How everything runs locally and in the cloud. Docker locally, AWS then GCP in deployment. |
| **Observability** | Visibility into what the running system is doing. Logs, uptime, performance. |
| **Documentation** | Code-level docs (TSDoc), API spec (OpenAPI/Swagger), generated docs site (TypeDoc + Starlight). |

### 2.2 Phases

Phases are **sequential stages of the project**. Each phase produces a complete, deployed, demoable product — not just a layer or a feature. Earlier phases are not discarded. Each phase builds on and extends the previous one.

There are five phases.

### 2.3 Architectural Modes

The project transitions between two architectural modes:

- **Monolith** (Phases 1–3): The entire backend is one deployable NestJS application.
- **Microservices** (Phases 4–5): The backend is decomposed into independent, separately deployable NestJS services communicating via a message broker.

### 2.4 Environments

| Environment | How |
|---|---|
| **Local** | Docker Compose. Runs the full stack on your machine. Present at every phase. |
| **Deployed — AWS** | Phases 1–3. EC2 + RDS. Free tier. |
| **Deployed — GCP** | Phases 4–5. Cloud Run. Permanently free at portfolio traffic levels. |

---

## 3. Master Technology Stack

Everything used across the entire project, organized by layer. This list captures technology and tool choices — not specific package names or sub-packages. Package names belong in `package.json`. Specific choices are noted only where a deliberate decision between competing options was made.

### 3.1 Backend

| Concern | Choice | Note |
|---|---|---|
| Runtime | Node.js (LTS) | |
| Language | TypeScript | |
| Framework | NestJS | |
| Authentication | Passport.js, JWT | Via NestJS integration |
| Password hashing | argon2 | Deliberate choice over bcrypt — memory-hard, PHC winner, bcrypt has a 72-char truncation issue |
| Authorization | RBAC (admin / seller / customer) | Simple role-based, no external library |
| ORM | TypeORM | Via NestJS integration; handles migrations and schema evolution |
| Database driver | Handled by TypeORM | |
| API spec | OpenAPI / Swagger | Auto-generated from NestJS decorators, browsable at `/api` |
| Input validation | class-validator | Via NestJS integration |
| Logging | Pino | Via NestJS integration; pino-pretty for local dev readability |
| Seed data | Faker.js | |
| Testing — unit + integration | Vitest | |
| Testing — E2E API | Supertest | Runs against the live NestJS app in test environment |
| Microservices transport (Phase 4+) | NestJS Microservices | Built into NestJS |

### 3.2 Frontend — Next.js (Primary, Phase 1+)

| Concern | Choice | Note |
|---|---|---|
| Framework | Next.js | SSR where appropriate |
| Language | TypeScript | |
| Styling | Tailwind CSS | |
| Server state / data fetching | TanStack Query | |
| Forms | React Hook Form + Zod | |
| Auth flows | NextAuth | |
| API client | orval | Deliberate choice — generates a fully typed client from the OpenAPI spec automatically |
| Component documentation | Storybook | Added after core UI stabilizes |
| Testing — unit | Vitest | |
| Testing — integration | React Testing Library | Component-level integration tests |
| Testing — E2E | Playwright | |
| API mocking (tests) | MSW (Mock Service Worker) | Intercepts at network level; realistic API simulation in tests |

### 3.3 Frontend — Nuxt.js (Phase 3+)

| Concern | Choice | Note |
|---|---|---|
| Framework | Nuxt.js | Vue-based |
| Language | TypeScript | |
| State management | Pinia | |
| Styling | Tailwind CSS | |
| Validation | Zod | |
| API calls | ofetch | Built into Nuxt |
| Testing — unit + integration | Vitest + @nuxt/test-utils | Official Nuxt testing utilities |
| Testing — E2E | Playwright | |
| API mocking (tests) | MSW | |

### 3.4 Frontend — Angular (Phase 3+)

| Concern | Choice | Note |
|---|---|---|
| Framework | Angular | |
| Language | TypeScript | |
| UI components | Angular Material | |
| Auth flows | angular-oauth2-oidc | |
| Validation | Zod | |
| Testing — unit + integration | Jest + @testing-library/angular | Deliberate choice over Vitest — Vitest support in Angular is experimental |
| Testing — E2E | Playwright | |
| API mocking (tests) | MSW | |

### 3.5 Database

| Concern | Choice | Note |
|---|---|---|
| Database | PostgreSQL | Present throughout all phases |
| Local GUI | pgweb | Runs as a Docker Compose service locally |
| Migrations | TypeORM | Schema-driven, version-controlled |

### 3.6 Infrastructure & DevOps

**Local (all phases)**

| Concern | Choice |
|---|---|
| Containerization | Docker |
| Local orchestration | Docker Compose v2 |
| Image builds | Multi-stage Dockerfiles per service |

**CI/CD (all phases)**

| Concern | Choice | What it runs |
|---|---|---|
| Pipeline | GitHub Actions | Lint, format check, tests, build — fails fast |

**AWS (Phases 1–3)**

| Resource | Spec | Note |
|---|---|---|
| Compute | EC2 t3.micro | Runs full Docker Compose stack; free tier 12 months |
| Database | RDS PostgreSQL t3.micro | Managed; free tier 12 months |
| Monitoring | CloudWatch | Billing alarm set at $1 threshold immediately |

**GCP (Phases 4–5)**

| Resource | Note |
|---|---|
| Cloud Run | One deployment per microservice; scales to zero; permanently free at portfolio traffic |
| Pub/Sub | Async messaging between services; 10GB/month free |
| Artifact Registry | Container image storage |
| Cloud SQL | Optional managed Postgres on GCP; covered by trial credits |

### 3.7 Observability

| Concern | Choice | Note |
|---|---|---|
| Structured logging | Pino | JSON logs from backend; human-readable in local dev |
| Log ingestion + uptime | BetterStack | Free tier sufficient; present from Phase 1 |
| Cloud monitoring | CloudWatch | AWS billing alarms, Phases 1–3 |
| Distributed tracing (Phase 5) | OpenTelemetry | Instrumentation standard; backend: BetterStack or GCP Cloud Trace |

### 3.8 Documentation

| Concern | Choice | Note |
|---|---|---|
| Inline code docs | TSDoc | Annotation standard for TypeScript |
| Reference generation | TypeDoc | Generates API reference from TSDoc |
| Docs site | Starlight | Astro-based; hosts TypeDoc output |
| API spec | OpenAPI / Swagger | Auto-generated by NestJS; browsable at `/api` |
| Typed frontend client | orval | Consumes the OpenAPI spec; used by all three frontends |

### 3.9 Tooling

| Concern | Choice | Note |
|---|---|---|
| Linting + formatting | Biome | Deliberate choice over ESLint + Prettier — one tool, significantly faster |
| Pre-commit / pre-push hooks | Lefthook | Runs Biome on staged files; faster and config-file-driven |
| Environment variables | `.env` files per environment | |

### 3.10 Load Testing (Phase 2)

| Concern | Choice | Note |
|---|---|---|
| Load testing | k6 | Not an npm package — installed separately. Scriptable in JavaScript. |

---

## 4. Phases

---

### Phase 1 — Complete Monolith, Deployed on AWS

**Goal:** Ship a complete, working, deployed full-stack product. Every layer exists and is functional. This is the baseline everything else builds on.

**What gets built:**
- NestJS backend with full auth (JWT, RBAC: admin / seller / customer), product catalog, cart, orders, and basic checkout
- TypeORM schema with migrations and seed script (moderate data volume for initial development)
- OpenAPI spec auto-generated and browsable
- TSDoc annotations throughout the backend codebase
- TypeDoc + Starlight generating a documentation website
- Next.js frontend consuming the backend via an orval-generated typed client
- Pino structured logging in the backend
- BetterStack connected for log ingestion and uptime
- Docker Compose running the full stack locally: NestJS + Next.js + Postgres + pgweb
- Multi-stage Dockerfiles for NestJS and Next.js
- GitHub Actions: lint (Biome), format check, tests, build — fails fast on errors
- Lefthook pre-commit and pre-push hooks
- Deployed on AWS: EC2 `t3.micro` running Docker Compose, RDS PostgreSQL `t3.micro`
- CloudWatch billing alarm set at $1

**Deferred to later phases:** massive seed data, load testing, Nuxt/Angular, microservices, GCP.

**Resume milestone:** *"Full-stack e-commerce platform — NestJS, Next.js, PostgreSQL — deployed on AWS with CI/CD, structured logging, and auto-generated API and code documentation."*

---

### Phase 2 — Hardened Monolith

**Goal:** Find out what the system actually does under production-like conditions. Fix the real problems. This phase adds no user-facing features — it makes the existing system honest.

**What gets built / done:**
- Expanded seed script using Faker.js: 50,000+ products, 10,000+ users, realistic order and cart history. The goal is to surface problems that only appear at volume.
- k6 load test scripts simulating realistic traffic patterns: product listing, search, checkout flows, concurrent users.
- Systematic diagnosis of what breaks: N+1 queries, missing indexes, missing composite indexes on foreign keys, connection pool exhaustion, slow queries under join pressure.
- Fixes applied: TypeORM index definitions, query restructuring, connection pool tuning, response-level caching where appropriate.
- BetterStack observability properly wired and used to observe the system during load tests.
- Potentially move Postgres from Docker-in-EC2 to RDS if not already (better isolation, easier to monitor).

**What this phase produces that is unique:** the ability to talk about *specific real problems* you found and the specific decisions you made to fix them. Most portfolio projects cannot do this.

**Resume milestone:** *"Stress-tested under realistic data volume (50k+ products, 10k+ users). Diagnosed and resolved performance bottlenecks including N+1 queries and missing composite indexes using k6 load testing."*

---

### Phase 3 — Multiple Frontends

**Goal:** Demonstrate that you can work across multiple frontend frameworks against the same API. The backend does not change.

**What gets built:**
- Nuxt.js frontend: Vue-based, Pinia state management, Tailwind CSS, same feature set as Next.js frontend.
- Angular frontend: Angular Material components, auth flows, same feature set.
- All three frontends (Next.js, Nuxt.js, Angular) deployed and accessible in parallel.
- Next.js on Vercel or AWS Amplify. Nuxt.js and Angular on Vercel or separate Amplify apps. All pointing at the same backend API.
- Storybook added to the Next.js frontend for component documentation after the UI stabilizes.

**Resume milestone:** *"Same NestJS API consumed simultaneously by three frontend frameworks — Next.js, Nuxt.js, Angular — each independently deployed."*

---

### Phase 4 — Microservices on GCP Cloud Run

**Goal:** Decompose the monolith into independently deployable services. Redeploy on GCP. Introduce async messaging. This is a fundamentally different architecture, not an extension of Phase 3.

**Decomposition (likely service boundaries):**
- `auth-service` — user registration, login, token issuance and validation
- `catalog-service` — products, categories, inventory
- `order-service` — cart, orders, checkout
- `api-gateway` — single entry point, routes requests to services, handles auth verification

Each service is its own NestJS application with its own TypeORM schema and its own database (or schema-isolated database). They do not share a database.

**What gets built:**
- NestJS Microservices transport wiring per service
- GCP Pub/Sub as the async message broker between services (replaces direct calls for events like "order placed" → catalog updates inventory)
- Per-service `Dockerfile` and per-service Cloud Run deployment
- Docker Compose updated to run all services locally for development
- GitHub Actions updated: per-service pipelines, each service builds and deploys independently
- GCP Artifact Registry stores container images

**The interesting architecture problems this phase surfaces:**
- Cross-service transactions (order creation touching catalog and auth) — how do you handle these without a shared DB?
- Eventual consistency — what happens if the catalog service is down when an order is placed?
- Service discovery — how does the API gateway know where to route?

These are the things you talk about in interviews.

**Resume milestone:** *"Migrated monolith to microservices (auth, catalog, orders, API gateway). Deployed independently on GCP Cloud Run with GCP Pub/Sub for async inter-service messaging."*

---

### Phase 5 — Production Microservices + Full Observability

**Goal:** Make the microservices deployment production-grade. Add distributed tracing, proper per-service observability, and mature the operational story.

**What gets built:**
- Distributed tracing across services (OpenTelemetry instrumentation, BetterStack or GCP Cloud Trace as backend)
- Centralized structured logging across all services into BetterStack
- Health check endpoints per service, monitored by BetterStack uptime
- Per-service alerting (if a service goes down, you know which one)
- API Gateway hardening: rate limiting, request validation at the gateway level
- Potentially: GCP Cloud Armor for basic DDoS protection (free tier)

**Optional extension:** If targeting DevOps/platform engineering roles specifically, GKE (Google Kubernetes Engine) replaces Cloud Run here. This adds Kubernetes configuration (Deployments, Services, ConfigMaps, Secrets, Ingress) and a Helm chart per service. This is a significant scope increase and only worth doing if Kubernetes specifically is a target skill.

**Resume milestone:** *"Production microservices on GCP with distributed tracing via OpenTelemetry, centralized logging via BetterStack, per-service health monitoring, and independent deployment pipelines per service."*

---

## 5. The AI Layer (Post Phase 5 Only)

After all five phases are complete and deployed, one optional, self-contained AI feature may be added. It must not alter the core backend architecture and must be explainable to a non-technical recruiter in one sentence.

Candidates: natural-language product search over the catalog (pgvector + embedding search), or a conversational commerce assistant on the customer side.

This is not part of the employability-critical core. Do not start this until Phase 5 is shipped.

---

## 6. Career Targeting

**Role:** Full-Stack Developer (Node.js / TypeScript) — primary positioning after Phase 1.

**Alternate role:** Backend Developer (Node.js) — if you prefer to specialize. The frontend work remains on the resume as a differentiator.

**Do not target:** DevOps Engineer, Cloud Engineer, Frontend-only roles.

**Job market:** International remote is the primary target. Indian corporate pipelines with ATS filtering are hostile to a no-degree profile and are a secondary target at best. Wellfound (AngelList), Contra, arc.dev, LinkedIn (remote filter), and direct founder/CTO outreach on LinkedIn and Twitter/X are the channels that bypass ATS.

**Minimum resume trigger:** End of Phase 1. Update the resume description incrementally as each phase completes.

---

## 7. What Each Phase Demonstrates

| Phase | Core demonstration |
|---|---|
| 1 | Can design, build, and ship a full-stack system. Understands deployment, CI/CD, documentation. |
| 2 | Has operated a system under realistic load. Can diagnose and fix real performance problems. |
| 3 | Is not framework-locked. Can work across the major frontend ecosystems. |
| 4 | Understands distributed systems tradeoffs. Has navigated an architectural migration. |
| 5 | Can operate a production microservices system. Understands observability. |
