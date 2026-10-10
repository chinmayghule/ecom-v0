# External Integrations

**Analysis Date:** 2026-06-15

## APIs & External Services

**API Documentation / Testing:**
- **Postman** - API collection management
  - Collection: `ecom-v0` at https://api.getpostman.com/collections
  - Auth: API key in `.env.local` (`POSTMAN_API_KEY`)
  - Workflow: Sync endpoints after tests pass (manual trigger)

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
- Console logging via NestJS default logger
- TypeORM query logging enabled when `NODE_ENV !== 'test'` (see `src/app.module.ts:60`)

## CI/CD & Deployment

**Hosting:**
- Not configured (no Vercel, AWS, Railway, etc. config files)

**CI Pipeline:**
- Not configured (no GitHub Actions, GitLab CI, etc. files detected)

**Local Dev Infrastructure (Docker Compose):**
- `docker-compose.yml`:
  - `postgres` - Main DB (port 5432), persistent volume `postgres_data`
  - `pgweb` - Web UI for DB (port 8081)
  - `postgres-test` - Test DB (port 5433), `profile: test`, healthcheck

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