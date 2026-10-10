# Architecture

**Analysis Date:** 2026-06-15

## Architectural Pattern

**Pattern:** Modular Monolith (NestJS)

- Single deployable unit with clear module boundaries
- Feature modules: `AuthModule`, `UsersModule`
- Future modules planned: Products, Orders, Cart, Categories
- Shared kernel: entities, guards, policies, decorators

## Layers

```
src/
├── main.ts                 # Bootstrap / entry point
├── app.module.ts           # Root module, global config
├── app.controller.ts       # Health check endpoint
├── app.service.ts          # Health check logic
├── data-source.ts          # TypeORM CLI configuration
├── entities/               # Domain entities (shared kernel)
│   ├── user.entity.ts
│   ├── product.entity.ts
│   ├── category.entity.ts
│   ├── order.entity.ts
│   ├── order-item.entity.ts
│   ├── cart.entity.ts
│   ├── cart-item.entity.ts
│   ├── address.entity.ts
│   ├── seller-profile.entity.ts
│   ├── inventory.entity.ts
│   └── session.entity.ts
├── auth/                   # Authentication & Authorization module
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/         # Passport strategies
│   ├── guards/             # Route guards
│   ├── decorators/         # Custom decorators
│   ├── policies/           # Policy-based authorization
│   ├── dto/                # Data Transfer Objects
│   ├── entities/           # Auth-specific entities (ResetToken)
│   └── __tests__/          # Unit tests
├── users/                  # User management module
│   ├── users.module.ts
│   ├── users.service.ts
│   └── __tests__/          # Unit tests
├── migrations/             # TypeORM migrations
└── test/                   # E2E tests
    ├── setup.e2e.ts
    ├── auth.e2e-spec.ts
    └── app.e2e-spec.ts
```

## Data Flow

1. **Request** → `main.ts` (helmet, cors, cookie-parser, global ValidationPipe)
2. **Controller** → DTO validation via `class-validator` decorators
3. **Service** → Business logic, entity operations via TypeORM Repository
4. **Database** → PostgreSQL via TypeORM (migrations-based, `synchronize: false`)
5. **Response** → Serialized via `class-transformer`

## Entry Points

| Entry Point | File | Purpose |
|-------------|------|---------|
| HTTP Server | `src/main.ts` | Bootstrap NestJS app, global middleware/pipes |
| CLI (TypeORM) | `src/data-source.ts` | Migration generation, running, reverting |

## Module Dependencies

```
AppModule (root)
├── ConfigModule (global)
├── TypeOrmModule (async, config-driven)
├── ThrottlerModule (global guard)
├── AuthModule
│   ├── UsersModule
│   ├── PassportModule
│   ├── JwtModule (async)
│   └── TypeOrmModule.forFeature([Session, ResetToken])
└── UsersModule
    └── TypeOrmModule.forFeature([User])
```

## Abstractions

### Guards (Cross-cutting)
- `ThrottlerGuard` — Rate limiting (100 req/60s)
- `JwtAuthGuard` — JWT validation via Passport
- `RolesGuard` — Role-based access (`customer` | `seller` | `admin`)
- `PoliciesGuard` — Policy-based authorization
- `RefreshTokenGuard` — Refresh token validation

### Policies (Authorization)
- `BasePolicy` — Abstract base with `can(user, resource, action)`
- `ProductPolicy` — Product CRUD permissions
- `OrderPolicy` — Order ownership/access
- `CartPolicy` — Cart ownership
- `SellerProfilePolicy` — Seller profile management

### Decorators
- `@Roles(...)` — Declare required roles
- `@Public()` — Skip auth guard
- `@CurrentUser()` — Inject authenticated user
- `@CheckPolicies(...)` — Declare required policies

### Strategies
- `JwtStrategy` — Passport JWT verification (access tokens)

## Configuration Management

- `@nestjs/config` with `ConfigModule.forRoot({ isGlobal: true })`
- Loads `.env` from repo root (and `../.env` when running from `backend/`)
- TypeORM config via `ConfigService` in `TypeOrmModule.forRootAsync`
- JWT config via `JwtModule.registerAsync`

## Security Boundaries

- Helmet headers
- CORS restricted to `CORS_ORIGIN` (default `http://localhost:3000`)
- HTTP-only cookies for refresh tokens
- Global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`
- Argon2id password hashing
- Separate JWT secrets for access/refresh tokens

## Database Schema

**Migration-based** (TypeORM, `synchronize: false`)

- Migrations in `src/migrations/` (e.g., `1780482709590-CreateAllTables.ts`)
- Entities define schema declaratively
- Key tables: users, products, categories, orders, order_items, carts, cart_items, sessions, addresses, seller_profiles, inventory, reset_tokens

---

*Architecture analysis: 2026-06-15*