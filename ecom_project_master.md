# E-commerce Project: Master Document

---

## 1. Purpose

This project exists for **employability**. The goal is to demonstrate that you can design, build, stress-test, deploy, and evolve a real full-stack web system — end to end, without scope collapse.

The secondary goal is to produce something that tells a coherent story across multiple resume updates: a deployed monolith, then a hardened monolith under realistic load, then a decomposition into microservices. Optional phases extend that story to a native mobile client and to production-grade operations — they are not on the critical path.

---

## 2. Terminology

Before phases and packages, the vocabulary needs to be exact.

### 2.1 Layers

Layers are the functional divisions inside the application. They exist **simultaneously** at every phase. Adding a new phase does not replace layers — it evolves them.

| Layer | What it is |
|---|---|
| **Frontend** | User-facing UI. A Next.js web client from Phase 1; an optional React Native mobile client from Phase 4. |
| **Backend (API)** | Business logic, data access, authentication, authorization. NestJS throughout. |
| **Database** | Persistent storage. PostgreSQL throughout. |
| **Infrastructure** | How everything runs locally and in the cloud. Docker locally, free-tier services (Vercel, Render, Neon) then GCP in deployment. |
| **Observability** | Visibility into what the running system is doing. Logs, uptime, performance. |
| **Documentation** | Code-level docs (TSDoc), API spec (OpenAPI/Swagger), generated docs site (TypeDoc + Starlight). |

### 2.2 Phases

Phases are **sequential stages of the project**. Each phase produces a complete, deployed, demoable product — not just a layer or a feature. Earlier phases are not discarded. Each phase builds on and extends the previous one.

There are five phases. Phases 1–3 are the core: each one ships a complete, deployed, demoable product, and together they carry the employability story. Phases 4 and 5 are **optional extensions** — they deepen the story but are not required before the core phases count as delivered. Scope the project by finishing Phases 1–3; treat everything after that as additive if time allows.

| | Phases | Status |
|---|---|---|
| **Core** | 1 — Complete Monolith, 2 — Hardened Monolith, 3 — Microservices | On the critical path |
| **Optional** | 4 — Mobile Client, 5 — Production Microservices | Extensions, see each phase for when they are worth doing |

### 2.3 Architectural Modes

The project transitions between two architectural modes:

- **Monolith** (Phases 1–2): The entire backend is one deployable NestJS application.
- **Microservices** (Phases 3–5): The backend is decomposed into independent, separately deployable NestJS services communicating via a message broker.

### 2.4 Environments

| Environment | How |
|---|---|
| **Local** | Docker Compose. Runs the full stack on your machine. Present at every phase. |
| **Deployed — Free Tier** | Phases 1–2, plus optional Phase 4. Vercel (web frontend) + Render (backend) + Neon (PostgreSQL). All free tier. |
| **Deployed — GCP** | Phases 3–5. Cloud Run. Permanently free at portfolio traffic levels. |

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
| Microservices transport (Phase 3+) | NestJS Microservices | Built into NestJS |

### 3.2 Frontend — Next.js (Primary, Phase 1+)

| Concern | Choice | Note |
|---|---|---|
| Framework | Next.js | SSR where appropriate |
| Language | TypeScript | |
| Styling | Tailwind CSS | |
| UI components | Shadcn UI | Component library built on Radix + Tailwind |
| Server state / data fetching | TanStack Query | |
| Forms | React Hook Form + Zod | |
| Auth flows | Custom JWT handling | Direct JWT in httpOnly cookies / localStorage; no NextAuth |
| API calls | Express.js route handlers | Next.js API routes using Express.js to call backend; orval optional |
| Component documentation | Storybook | Ships in Phase 1 alongside the web client |
| Testing — unit | Vitest | |
| Testing — integration | React Testing Library | Component-level integration tests |
| Testing — E2E | Playwright | |
| API mocking (tests) | MSW (Mock Service Worker) | Intercepts at network level; realistic API simulation in tests |

### 3.3 Frontend — React Native (Phase 4+, optional)

Native mobile client. Optional — see Phase 4 for when it is worth building.

| Concern | Choice | Note |
|---|---|---|
| Framework | React Native via Expo | Chosen so a build needs no local Xcode or Android Studio |
| Language | TypeScript | Same as every other package in the workspace |
| Styling | NativeWind | Tailwind syntax; carries over from the web client |
| Server state / data fetching | TanStack Query | Same library as the web client |
| Forms | React Hook Form + Zod | Parity with the web client |
| Navigation | React Navigation | Expo's recommended option |
| Token storage | `expo-secure-store` | The web client uses an httpOnly cookie; a native client cannot. Requires an explicit auth decision in Phase 4. |
| Testing — unit + integration | Jest + @testing-library/react-native | Jest is the ecosystem default for React Native |
| Testing — E2E | Maestro or Detox | Playwright drives browsers and cannot drive a native app |
| API mocking (tests) | MSW | Same as the web client |

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

**Free Tier (Phases 1–2, plus optional Phase 4)**

| Resource | Platform | Note |
|---|---|---|
| Frontend hosting | Vercel (Hobby) | Auto-deploys from GitHub; free tier |
| Backend hosting | Render (Web Service) | Auto-deploys from GitHub; free tier |
| Database | Neon (PostgreSQL) | Serverless Postgres; free tier includes 500MB storage |
| Mobile builds (optional Phase 4) | Expo EAS Build (Free plan) | 15 Android + 15 iOS builds/month, low-priority queue. No Apple Developer account needed for Android APKs. |

**GCP (Phases 3–5)**

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
| Cloud monitoring | N/A (free tier) | No cloud monitoring in Phases 1–2 — BetterStack covers uptime |
| Distributed tracing (Phase 5, optional) | OpenTelemetry | Instrumentation standard; backend: BetterStack or GCP Cloud Trace |

### 3.8 Documentation

| Concern | Choice | Note |
|---|---|---|
| Inline code docs | TSDoc | Annotation standard for TypeScript |
| Reference generation | TypeDoc | Generates API reference from TSDoc |
| Docs site | Starlight | Astro-based; hosts TypeDoc output |
| API spec | OpenAPI / Swagger | Auto-generated by NestJS; browsable at `/api` |
| Typed frontend client | orval | Consumes the OpenAPI spec; used by both the web and mobile clients |

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

### Phase 1 — Complete Monolith

**Goal:** Ship a complete, working, deployed full-stack product. Every layer exists and is functional. This is the baseline everything else builds on.

**What gets built:**
- NestJS backend with full auth (JWT, RBAC: admin / seller / customer), product catalog, cart, orders, and basic checkout
- TypeORM schema with migrations and seed script (moderate data volume for initial development)
- OpenAPI spec auto-generated and browsable
- TSDoc annotations throughout the backend codebase
- TypeDoc + Starlight generating a documentation website
- Next.js frontend consuming the backend via an orval-generated typed client
- Storybook documenting the shared component library used by the web client
- Pino structured logging in the backend
- BetterStack connected for log ingestion and uptime
- Docker Compose running the full stack locally: NestJS + Next.js + Postgres + pgweb
- Multi-stage Dockerfiles for NestJS and Next.js
- GitHub Actions: lint (Biome), format check, tests, build — fails fast on errors
- Lefthook pre-commit and pre-push hooks
- Deployed on Render (backend) + Vercel (frontend) + Neon (PostgreSQL) — all free tier

**Deferred to later phases:** massive seed data and load testing (Phase 2), microservices (Phase 3), and the optional mobile client (Phase 4) and production operations (Phase 5).

**Resume milestone:** *"Full-stack e-commerce platform — NestJS, Next.js, PostgreSQL — deployed on free tier (Render + Vercel + Neon) with CI/CD, structured logging, component documentation via Storybook, and auto-generated API and code documentation."*

---

### Phase 2 — Hardened Monolith

**Goal:** Find out what the system actually does under production-like conditions. Fix the real problems. This phase adds no user-facing features — it makes the existing system honest.

**What gets built / done:**
- Expanded seed script using Faker.js: 50,000+ products, 10,000+ users, realistic order and cart history. The goal is to surface problems that only appear at volume.
- k6 load test scripts simulating realistic traffic patterns: product listing, search, checkout flows, concurrent users.
- Systematic diagnosis of what breaks: N+1 queries, missing indexes, missing composite indexes on foreign keys, connection pool exhaustion, slow queries under join pressure.
- Fixes applied: TypeORM index definitions, query restructuring, connection pool tuning, response-level caching where appropriate.
- BetterStack observability properly wired and used to observe the system during load tests.
- Database is already on managed Neon (serverless Postgres) — no migration needed.

**What this phase produces that is unique:** the ability to talk about *specific real problems* you found and the specific decisions you made to fix them. Most portfolio projects cannot do this.

**Resume milestone:** *"Stress-tested under realistic data volume (50k+ products, 10k+ users). Diagnosed and resolved performance bottlenecks including N+1 queries and missing composite indexes using k6 load testing."*

---

### Phase 3 — Microservices on GCP Cloud Run

**Goal:** Decompose the monolith into independently deployable services. Redeploy on GCP. Introduce async messaging. This is a fundamentally different architecture, not an extension of Phase 2.

Hardening the monolith first (Phase 2) is deliberate: the index, query, and connection-pool problems diagnosed there are exactly the ones that resurface at service boundaries, so the fixes carry across the split.

**Decomposition (likely service boundaries):**
- `auth-service` — user registration, login, token issuance and validation
- `catalog-service` — products, categories, inventory
- `order-service` — cart, orders, checkout
- `api-gateway` — single entry point, routes requests to services, handles auth verification

Each service is its own NestJS application with its own TypeORM schema and its own database (or schema-isolated database). They do not share a database.

**Open decision for this phase:** whether each service gets a separate Neon database or a separate schema within one database. Neon supports multiple databases per project, so either is viable; the choice affects isolation guarantees and migration tooling, and should be settled when this phase is planned.

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

### Phase 4 — Mobile Client (Optional)

**Status: optional.** The core employability story is delivered by Phases 1–3. Build this if targeting roles where mobile client work is a differentiator, or once Phases 1–3 are shipped and stable. It is not on the critical path, and the project is complete without it.

**Goal:** Prove the same backend serves a native client, not just a browser. One API, two very different client platforms.

**Scope:** Customer-facing only — auth, catalog browsing and search, product detail, cart, checkout, and order history. Seller and admin tooling stays on the web client; a phone is the wrong surface for product management, and building it would double the phase's cost for little demonstrable value. Feature parity with the web client is the goal *for the customer journey specifically*, not across every screen.

**What gets built:**
- React Native app via Expo, consuming the API through the Phase 3 gateway
- Typed API client generated from the same OpenAPI spec as the web client
- Customer journey implemented as listed above
- Android APK built via EAS Build (Free plan) and published as a download from the portfolio site

**Distribution — free tier only:**
- **Android (primary):** an APK from EAS Build's Free plan, which provides its own signing keystore. No Google Play developer account needed. The reviewer enables "install unknown apps" and installs it. Published from the portfolio site, not a store.
- **iOS (secondary):** Expo Go plus EAS Update. Installing on an actual iPhone requires a paid Apple Developer Program account for build signing, so a downloadable iOS artifact is out of scope for this project. Expo Go reaches iOS reviewers without that account.
- **Free plan limits to respect:** 15 Android and 15 iOS builds per month, on a low-priority queue. Build on release only — never wire EAS Build into a per-push CI trigger, or the quota is gone before the month ends.
- Not doing: Play Store or App Store publication, or a `react-native-web` deployment.

**What this phase demonstrates:** shipping one backend to two client platforms, and making the platform-appropriate choices each requires — secure token storage instead of httpOnly cookies, native navigation, a native test runner instead of Playwright.

**Resume milestone:** *"Same NestJS API serving a Next.js web client and a React Native mobile client — two platforms, one typed API contract, independently built and distributed."*

---

### Phase 5 — Production Microservices + Full Observability (Optional)

**Status: optional.** Consistent with Phase 4: the core story ends at Phase 3. Build this if targeting DevOps or platform engineering roles, where operational maturity is the thing being demonstrated. The project is complete without it.

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

## 5. The AI Layer (Optional)

One optional, self-contained AI feature may be added once the microservices decomposition (Phase 3) is shipped and stable. It must not alter the core backend architecture and must be explainable to a non-technical recruiter in one sentence.

Candidates: natural-language product search over the catalog (pgvector + embedding search), or a conversational commerce assistant on the customer side.

**Status: optional.** Like Phases 4 and 5, this is an extension rather than part of the core. If it comes at all, it comes after the Phase 3 decomposition is stable — it does not need to wait on the optional phases, and it must not be started before Phase 3 is shipped.

---

## 6. Career Targeting

**Role:** Full-Stack Developer (Node.js / TypeScript) — primary positioning after Phase 1.

**Alternate role:** Backend Developer (Node.js) — if you prefer to specialize. The frontend work remains on the resume as a differentiator.

**Do not target:** DevOps Engineer, Cloud Engineer, Frontend-only roles.

**Job market:** International remote is the primary target. Indian corporate pipelines with ATS filtering are hostile to a no-degree profile and are a secondary target at best. Wellfound (AngelList), Contra, arc.dev, LinkedIn (remote filter), and direct founder/CTO outreach on LinkedIn and Twitter/X are the channels that bypass ATS.

**Minimum resume trigger:** End of Phase 1. Update the resume description incrementally as each core phase completes. Phases 4 and 5 add depth but are not gating.

---

## 7. What Each Phase Demonstrates

| Phase | Core demonstration | Status |
|---|---|---|
| 1 | Can design, build, and ship a full-stack system. Understands deployment, CI/CD, documentation. | Core |
| 2 | Has operated a system under realistic load. Can diagnose and fix real performance problems. | Core |
| 3 | Understands distributed systems tradeoffs. Has navigated an architectural migration. | Core |
| 4 | Can serve one backend to multiple client platforms, and adapt to each platform's constraints. | Optional |
| 5 | Can operate a production microservices system. Understands observability. | Optional |

**Where the framework-breadth story went.** Earlier drafts of this plan had Phase 3 as three separate web frontends (Next.js, Nuxt, Angular) to demonstrate working across frontend ecosystems. That was dropped: it doubled the surface area without adding architectural depth, and the breadth it provided is now covered differently — by the web-plus-native platform split in Phase 4 and by the backend architecture work in Phase 3. The primary positioning (Full-Stack, Node.js/TypeScript) is served better by that trade.
