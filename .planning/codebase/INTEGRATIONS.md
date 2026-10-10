# External Integrations

**Snapshot: 2026-06-15 — corrected 2026-10-10.** Entries checked since then are
marked. Current state of record is `.planning/STATE.md`.

## On writing down where a secret lives

Naming the environment variable and the file that holds it is **not** a leak, and
this file should keep doing it — a setup guide that says "unknown" is useless, and
the variable name carries no capability on its own. What must never appear here is
the *value*.

`.env.local` is gitignored and `guard-ignored-tracked` blocks it from being staged,
so the separation is enforced rather than assumed.

## APIs & External Services

**API Documentation / Testing:**
- **Postman** - API collection management
  - Collection: `ecom-v0` at https://api.getpostman.com/collections
  - Auth: API key in `.env.local` (`POSTMAN_API_KEY`) — name and location only
  - Workflow: Sync endpoints after tests pass (manual trigger)

**Transactional Email:**
- **Resend** - password reset delivery (`src/email/resend-email.service.ts`)
- **SMTP** - selected via `EMAIL_TRANSPORT`, defaulting to `smtp` in development
- **Mailpit** — local SMTP sink added since this snapshot. `docker-compose.yml`
  starts it; web UI on `http://localhost:8025`. `SmtpEmailService` renders the same
  HTML the Resend transport sends, so a reset email can be inspected as a rendered
  message rather than copied out of a log line. No env var required; set
  `EMAIL_TRANSPORT=console` to bypass it and log instead.
- **DevEmailService** - logs instead of sending, for when there is no SMTP at all

## Data Storage

**Databases:**
- **PostgreSQL** (via `pg` driver + TypeORM)
  - Connection: `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` env vars
  - Client: TypeORM 0.3.29 via `@nestjs/typeorm`
  - Dev: `localhost:5432` (Docker `postgres:alpine`)
  - Test: `127.0.0.1:5433` (Docker `postgres-test` profile)
  - Schema: Migrations-based (`synchronize: false`), migrations in `backend/src/migrations/`
  - Tables: users, products, categories, orders, order_items, carts, cart_items, sessions, addresses, seller_profiles, inventory, reset_tokens, migrations

**File Storage:**
- Local filesystem only (no cloud storage configured)

**Caching:**
- None configured (no Redis, in-memory only)

## Authentication & Identity

**Auth Provider:**
- **Custom JWT-based** (no external provider like Auth0, Supabase Auth, etc.)
  - Implementation: `@nestjs/jwt` + `passport-jwt` strategy (`src/auth/strategies/jwt.strategy.ts`)
  - Access tokens: 15 min expiry (`JWT_ACCESS_EXPIRATION_MS=900000`)
  - Refresh tokens: 7 days expiry (`JWT_REFRESH_EXPIRATION_MS=604800000`), stored in HTTP-only cookies
  - Password hashing: Argon2id via `argon2` (`src/auth/hash.service.ts`)
  - Roles: `customer` | `seller` | `admin` (enforced via `RolesGuard` + `@Roles()` decorator)
  - Policy-based authorization: Custom policies in `src/auth/policies/` (e.g., `SellerProfilePolicy`, `ProductPolicy`)

## Monitoring & Observability

**Error Tracking:**
- None configured (no Sentry, Datadog, etc.)

**Logs:**
- Pino structured logging with PII redaction (Phase 01) — **corrected**, this snapshot said "NestJS default logger"
- TypeORM query logging enabled when `NODE_ENV !== 'test'` (`src/app.module.ts:89`)

## CI/CD & Deployment

**Hosting:**
- Not configured (no Vercel, Render, Neon config yet — Phase 11)

**CI Pipeline:**
- `.github/workflows/ci.yml` — **corrected**, this snapshot said "not configured".
  Runs on every PR: local-only guard, planning-state guard, lint, `nest build`,
  a migration smoke test (apply → revert → apply on an empty database), unit,
  integration, and E2E. Required status check on both branches is `quality`.

**Local Dev Infrastructure (Docker Compose):**
- `docker-compose.yml`:
  - `postgres` - Main DB (port 5432), persistent volume `postgres_data`
  - `pgweb` - Web UI for DB (port 8081)
  - `postgres-test` - Test DB (port 5433), `profile: test`, healthcheck
  - `mailpit` - SMTP sink (1025) + web UI (8025)

## Environment Configuration

**Required env vars (from `.env.example`):**
| Variable | Purpose |
|----------|---------|
| `DATABASE_HOST` | PostgreSQL host |
| `DATABASE_PORT` | PostgreSQL port (5432 dev, 5433 test) |
| `DATABASE_USER` | DB username |
| `DATABASE_PASSWORD` | DB password |
| `DATABASE_NAME` | Database name (`ecommerce` / `ecommerce_test`) |
| `BACKEND_PORT` | Server port (default 3001) |
| `JWT_SECRET` | Access token signing secret (min 32 chars) |
| `JWT_ACCESS_EXPIRATION_MS` | Access token TTL (default 900000 = 15 min) |
| `JWT_REFRESH_SECRET` | Refresh token signing secret (different from access) |
| `JWT_REFRESH_EXPIRATION_MS` | Refresh token TTL (default 604800000 = 7 days) |
| `CORS_ORIGIN` | Allowed frontend origin (default `http://localhost:3000`) |
| `RESET_TOKEN_EXPIRATION_MS` | Password reset token TTL (default 3600000 = 1 hour) |

**Secrets location:**
- `.env` - Committed (dev defaults only)
- `.env.local` - **NOT committed** (contains `POSTMAN_API_KEY`)
- `.env.test` - Committed (test defaults)
- Production: Expected to use platform secret manager (not configured)

## Webhooks & Callbacks

**Incoming:**
- None configured

**Outgoing:**
- None configured

---

*Integration audit: 2026-06-15*