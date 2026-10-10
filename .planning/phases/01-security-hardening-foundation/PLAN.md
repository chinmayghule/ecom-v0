# Phase 01: Security Hardening & Foundation — Comprehensive Plan

---

## Frontmatter

```yaml
phase: 01-security-hardening-foundation
type: execute
waves: 4
files_modified:
  - backend/src/main.ts
  - backend/src/app.module.ts
  - backend/src/app.controller.ts
  - backend/src/app.service.ts
  - backend/src/auth/auth.service.ts
  - backend/src/auth/auth.controller.ts
  - backend/src/auth/auth.module.ts
  - backend/src/auth/session.service.ts
  - backend/src/auth/reset-token.service.ts
  - backend/src/auth/dto/register.dto.ts
  - backend/src/auth/hash.service.ts
  - backend/src/auth/guards/refresh-token.guard.ts
  - backend/src/entities/session.entity.ts
  - backend/src/auth/entities/reset-token.entity.ts
  - backend/src/entities/index.ts
  - backend/src/auth/policies/product.policy.ts
  - backend/src/auth/policies/order.policy.ts
  - backend/src/auth/policies/cart.policy.ts
  - backend/src/auth/policies/seller-profile.policy.ts
  - backend/src/auth/policies/base-policy.ts
  - backend/src/users/users.service.ts
  - backend/src/email/email.module.ts
  - backend/src/health/health.service.ts
  - backend/src/health/health.module.ts
  - backend/.env.example
files_created:
  - backend/src/auth/token-hash.service.ts
  - backend/src/auth/brute-force.service.ts
  - backend/src/auth/validators/is-strong-password.validator.ts
  - backend/src/entities/login-attempt.entity.ts
  - backend/src/email/email.module.ts
  - backend/src/email/interfaces/email-service.interface.ts
  - backend/src/email/resend-email.service.ts
  - backend/src/email/dev-email.service.ts
  - backend/src/email/templates/password-reset.html
  - backend/src/health/health.controller.ts
  - backend/src/health/health.module.ts
  - backend/src/health/health.service.ts

  - backend/src/auth/__tests__/token-hash.service.spec.ts
  - backend/src/auth/__tests__/brute-force.service.spec.ts
  - backend/src/auth/__tests__/validators/is-strong-password.spec.ts
  - backend/src/email/__tests__/email.service.spec.ts
  - backend/src/auth/policies/__tests__/order-policy-extended.spec.ts
  - backend/src/auth/policies/__tests__/product-policy-extended.spec.ts
  - backend/src/health/__tests__/health.service.spec.ts
  - backend/src/auth/__tests__/roles-guard.spec.ts
  - backend/src/auth/__tests__/jwt-strategy.spec.ts
  - backend/src/auth/__tests__/auth.controller.spec.ts
  - backend/src/auth/__tests__/login.dto.spec.ts
  - backend/src/auth/__tests__/forgot-password.dto.spec.ts
  - backend/src/auth/__tests__/reset-password.dto.spec.ts
requirements:
  - REQ-SEC-01, REQ-SEC-02, REQ-SEC-03, REQ-SEC-05
  - REQ-SEC-06, REQ-SEC-07, REQ-FND-01, REQ-FND-02, REQ-FND-03
  - CRIT-01 (soft-delete bypass), CRIT-02 (refresh token race condition)
  - MAJ-06 (Argon2 memory cost), MAJ-08 (PII in JWT), MAJ-09 (EmailModule timing bug)
  - MAJ-10 (reset_tokens FK), MAJ-12 (guard scope), MAJ-14 (security test coverage)
  - MAJ-16 (O(n) logout), MIN-04 (rate limits), MIN-05 (forgotPassword HttpCode)
  - MIN-06 (hardcoded JWT expiry), MIN-07 (Health module coupling)
autonomous: false
```

---

## Wave & Task Overview

| Wave | Focus | Tasks | Dependencies | File Overlap Check |
|------|-------|-------|--------------|-------------------|
| **1** | Foundation Infrastructure | Pino logging, Health endpoint, Email integration | None | No overlap between tasks |
| **2** | Token Security | Refresh token hashing, Reset token hashing, Token rotation | Wave 1 (conceptually independent but sequenced for safety) | Session service, Auth service overlap — sequential |
| **3** | Access Control & Validation | Brute force, Password strength | Wave 2 auth flow changes | — |
| **4** | Audit & Polish | Policy audit, E2E tests, Migrations | All prior waves | No code overlap with prior |

---

## Plan: 01-Foundation Infrastructure (Wave 1)

**Objective:** Install foundational infrastructure that all other features depend on — structured logging, health monitoring, and email capability.

**Purpose:** Replace console logging with production-grade Pino, add observability via `/health`, and enable transactional email sending with dev fallback.

---

### Work Item 1.1: Pino Structured Logging (REQ-FND-01)

**Goal:** Replace NestJS default console logger with `nestjs-pino` — structured JSON logging, PII redaction, request logging via `pino-http`, health endpoint exclusion, dev pretty-print, prod JSON.

**Implementation per D-09, D-10, D-11:**
- **D-09:** Log level `trace` in development, `info` in production
- **D-10:** `pino-http` logs all requests (method, URL, status, response time) except health endpoint
- **D-11:** PII redaction: `password`, `token`, `authorization`, `cookie`, `secret` + deep paths

#### Files to Create

| File | Purpose |
|------|---------|
| *(none new — all modifications to existing files)* | |

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/app.module.ts` | Import `LoggerModule` from `nestjs-pino`, add `LoggerModule.forRoot()` with pinoHttp config (level, transport, redact, autoLogging). Add `exclude: [{ method: RequestMethod.ALL, path: 'health' }]`. Import `RequestMethod` from `@nestjs/common`. |
| `backend/src/main.ts` | Pass `{ bufferLogs: true }` to `NestFactory.create()`. Add `app.useLogger(app.get(Logger))` after creation. Import `Logger` from `nestjs-pino`. |

#### Implementation Notes

```typescript
// app.module.ts — LoggerModule.forRoot() configuration
LoggerModule.forRoot({
  pinoHttp: [
    {
      name: 'ecom-v0',
      level: process.env.NODE_ENV === 'production' ? 'info' : 'trace',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
      redact: {
        paths: [
          'password', 'token', 'authorization', 'cookie', 'secret',
          'req.headers.cookie', 'req.headers.authorization',
          'body.password', 'body.token',
        ],
        censor: '[REDACTED]',
      },
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
    },
  ],
  exclude: [{ method: RequestMethod.ALL, path: 'health' }],
})
```

```typescript
// main.ts — bufferLogs and app.useLogger
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
```

Key notes:
- `pinoHttp` takes a **tuple** `[options, stream]` when transport is specified (per nestjs-pino API). When no transport (production), pass object directly.
- `bufferLogs: true` prevents log loss during NestJS startup before LoggerModule initializes.
- The `exclude` parameter fully skips the health endpoint (stronger than `autoLogging.ignore` which only suppresses request-completed logs but still binds request context).
- `pino-pretty` is a dev dependency — conditionally loaded only when `NODE_ENV !== 'production'`.

#### Test Strategy

| Test | Approach | Command |
|------|----------|---------|
| Logger initializes | Unit test on AppModule creation verifies LoggerModule is configured | `pnpm test` |
| PII redaction | Unit test: create a Pino logger instance, log object with `password: 'secret'`, verify output contains `[REDACTED]` not `'secret'` | `pnpm test` |
| Health endpoint excluded from logs | Integration: start app, hit `/health`, verify no log output for that request | `pnpm test` or manual |

#### Dependencies

| Type | Item |
|------|------|
| Package install | `pnpm add nestjs-pino pino-http pino-pretty --filter backend` |
| Package verification | All packages [ASSUMED] per RESEARCH.md Package Legitimacy Audit — no checkpoint needed. `pino-pretty` verified as peer dep that works with `nestjs-pino` |
| Needs from prior | None — Wave 1 independent |

---

### Work Item 1.2: Health Endpoint (REQ-FND-02)

**Goal:** Replace `AppController.getHello()` static response with a `/health` endpoint returning DB connectivity, server uptime, memory usage, last migration, and configured env var names (not values).

**Implementation per D-12, D-13:**
- **D-12:** Full status page: DB connectivity (`SELECT 1`), uptime, memory, last migration
- **D-13:** Show env var *names* that are configured (never values)

#### Files to Create

| File | Purpose |
|------|---------|
| `backend/src/health/health.controller.ts` | `GET /health` route, returns `healthService.check()` |
| `backend/src/health/health.service.ts` | DB query, uptime, memory, migrations query |
| `backend/src/health/health.module.ts` | NestJS module — registers HealthController and HealthService, imports TypeOrmModule.forFeature |
| `backend/src/health/__tests__/health.service.spec.ts` | Unit tests for health service |

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/app.module.ts` | Import `HealthModule` and add to `imports` array |
| `backend/src/app.controller.ts` | Remove `AppController` (no longer needed — health is now in its own module). **OR**: Keep it but delegate to HealthService. **Decision:** Remove `AppController` entirely; health is now in `HealthModule`. Remove `AppService` too since nothing else references it. |
| `backend/src/app.service.ts` | Delete this file (was only used by AppController.getHello()) |
| `backend/src/app.module.ts` | Remove `AppController` and `AppService` from providers/controllers |

#### Implementation Notes

```typescript
// health.service.ts
@Injectable()
export class HealthService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
  ) {}

  async check() {
    let dbStatus = 'ok';
    let lastMigration: string | null = null;
    try {
      await this.repo.query('SELECT 1');
      const migrations = await this.repo.query(
        `SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1`,
      );
      lastMigration = migrations[0]?.name ?? null;
    } catch {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        rss: process.memoryUsage().rss,
      },
      database: dbStatus,
      lastMigration,
    };
  }
}
```

```typescript
// health.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
```

Key notes:
- Health endpoint uses `TypeOrmModule.forFeature([User])` to get a repository for DB queries (least specific entity that exists).
- `migrations` table is a TypeORM system table — query it directly to get the last migration name.
- Return `status: 'degraded'` (not `'error'`) when DB is down — the endpoint should never throw, always respond.
- No env var values exposed. Only names shown as configured (present in ConfigService).
- `AppController` and `AppService` are removed entirely since nothing uses them. If any test references `AppController`, update that test.

#### Test Strategy

| Test | Approach | Command |
|------|----------|---------|
| Health returns ok when DB is up | Unit test HealthService.check() with mocked repo that returns successfully | `pnpm test -- health` |
| Health returns degraded when DB is down | Unit test: mock repo.query to throw, verify `status: 'degraded'` | `pnpm test -- health` |
| Health response shape | Verify all expected keys present: status, timestamp, uptime, memory, database, lastMigration | `pnpm test -- health` |
| E2E: GET /health returns 200 | Start NestJS app, use supertest to GET /health | `pnpm test:e2e` |

#### Dependencies

| Type | Item |
|------|------|
| Needs from prior | None — Wave 1 independent |
| File conflict check | `app.module.ts` also modified by Pino logging work item — **same file, must be sequential within Wave 1**. Sequence: Pino first, then Health. |

---

### Work Item 1.3: Resend Email Integration (REQ-FND-03)

**Goal:** Create `EmailService` abstraction with `ResendEmailService` (production) and `DevEmailService` (dev fallback). HTML template for password reset. Wire into `AuthService.forgotPassword()`.

**Implementation per D-14, D-15, D-16, D-17:**
- **D-14:** `EmailService` interface + `ResendEmailService` implementation
- **D-15:** Dev fallback logs to console (dev mode: `NODE_ENV !== 'production'`)
- **D-16:** Dedicated `.html` template in `templates/` directory
- **D-17:** 1 req/60s rate limit on forgot-password via `@Throttle()`

#### Files to Create

| File | Purpose |
|------|---------|
| `backend/src/email/interfaces/email-service.interface.ts` | `EmailOptions` type and `EmailService` interface |
| `backend/src/email/resend-email.service.ts` | Production implementation — sends via Resend SDK |
| `backend/src/email/dev-email.service.ts` | Dev fallback — logs to console via Logger |
| `backend/src/email/email.module.ts` | Dynamic module — provides `EMAIL_SERVICE` token with correct implementation based on NODE_ENV |
| `backend/src/email/templates/password-reset.html` | HTML template with `{{RESET_URL}}` and `{{EXPIRY_HOURS}}` placeholders |
| `backend/src/email/__tests__/email.service.spec.ts` | Unit tests for both implementations |

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/auth/auth.service.ts` | Inject `EMAIL_SERVICE` (via `@Inject('EMAIL_SERVICE')`). Update `forgotPassword()` to call `this.emailService.send()` with the loaded HTML template. Import `readFileSync` for template loading. |
| `backend/src/auth/auth.controller.ts` | Add `@Throttle({ default: { limit: 1, ttl: 60000 } })` to `forgotPassword()` method |
| `backend/src/app.module.ts` | Import `EmailModule.forRoot()` and add to `imports` |
| `backend/src/auth/auth.module.ts` | No changes unless `AuthModule` needs to re-export something for EmailModule. EmailModule is global-adjacent (imported at root), not in AuthModule. |
| `backend/.env.example` | Add `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `FRONTEND_URL` |

#### Implementation Notes

```typescript
// email-service.interface.ts
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface EmailService {
  send(options: EmailOptions): Promise<void>;
}
```

```typescript
// email.module.ts — dynamic module
@Module({})
export class EmailModule {
  static forRoot(): DynamicModule {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      module: EmailModule,
      providers: [
        {
          provide: 'EMAIL_SERVICE',
          useClass: isProduction ? ResendEmailService : DevEmailService,
        },
      ],
      exports: ['EMAIL_SERVICE'],
    };
  }
}
```

```typescript
// In auth.service.ts — updated forgotPassword
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Inject } from '@nestjs/common';

function loadTemplate(name: string, variables: Record<string, string>): string {
  const templatePath = join(process.cwd(), 'src', 'email', 'templates', `${name}.html`);
  let template = readFileSync(templatePath, 'utf-8');
  for (const [key, value] of Object.entries(variables)) {
    template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return template;
}

// In class constructor:
constructor(
  // ...existing deps...
  @Inject('EMAIL_SERVICE') private readonly emailService: EmailService,
) {}

// In forgotPassword body:
const html = loadTemplate('password-reset', {
  RESET_URL: resetUrl,
  EXPIRY_HOURS: '1',
});
await this.emailService.send({ to: user.email, subject: 'Password Reset - Ecom', html });
```

```html
<!-- templates/password-reset.html -->
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
  <h1>Password Reset</h1>
  <p>Click the link below to reset your password:</p>
  <p><a href="{{RESET_URL}}">{{RESET_URL}}</a></p>
  <p>This link expires in {{EXPIRY_HOURS}} hour(s).</p>
  <p>If you did not request this, please ignore this email.</p>
</body>
</html>
```

Key notes:
- `EmailModule.forRoot()` uses the dynamic module pattern to inject the correct implementation at startup.
- Template variables use `{{VAR}}` syntax with simple string replacement (no template engine, per D-16).
- `loadTemplate()` is a module-level utility function (not a service) — no dependency injection needed.
- The `@Throttle()` decorator on `forgotPassword` applies per-route globally (not per-email). Per-email tracking is deferred — the endpoint-level throttle is sufficient defense-in-depth.
- `FRONTEND_URL` env var is used to build the reset link URL.
- **Bootstrap validation:** Add `onModuleInit()` lifecycle hook in `ResendEmailService` that checks for `RESEND_API_KEY` in production and crashes early if missing (rather than failing on first email send).

#### Test Strategy

| Test | Approach | Command |
|------|----------|---------|
| DevEmailService logs instead of sending | Instantiate DevEmailService, call `send()`, verify Logger.log was called with expected body | `pnpm test -- email` |
| EmailService interface compliance | Both DevEmailService and ResendEmailService implement EmailService | Static type check |
| Template interpolation | Test loadTemplate replaces {{RESET_URL}} correctly | Unit test |
| forgotPassword calls email service | Mock EmailService, call authService.forgotPassword, verify send was called | `pnpm test -- auth` |

#### Dependencies

| Type | Item |
|------|------|
| Package install | `pnpm add resend --filter backend` |
| Package verification | `resend` [ASSUMED] per RESEARCH.md Package Legitimacy Audit |
| Needs from prior | None — Wave 1 independent |
| File conflict check | `app.module.ts` also modified by Pino + Health — sequence: Pino → Health → Email |

---

### Work Item 1.4: Fix EmailModule Timing Bug (MAJ-09)

**Goal:** Fix `EmailModule.forRoot()` evaluating `process.env.NODE_ENV` at module import time instead of runtime.

**Fix:** Replace `useClass` with `useFactory` that resolves `ConfigService` at provider initialization time.

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/email/email.module.ts` | Change to factory provider that injects `ConfigService` and checks `configService.get('NODE_ENV') === 'production'` |

#### Implementation

```typescript
// email.module.ts — fixed forRoot()
static forRoot(): DynamicModule {
  return {
    module: EmailModule,
    providers: [
      ResendEmailService,
      DevEmailService,
      {
        provide: 'EMAIL_SERVICE',
        useFactory: (configService: ConfigService) => {
          return configService.get('NODE_ENV') === 'production'
            ? new ResendEmailService(configService)
            : new DevEmailService();
        },
        inject: [ConfigService],
      },
    ],
    exports: ['EMAIL_SERVICE'],
  };
}
```

---

### Work Item 1.5: Fix Health Module Entity Coupling (MIN-07)

**Goal:** Remove `HealthService` dependency on `User` entity.

**Fix:** Replace `@InjectRepository(User)` with `DataSource` injection.

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/health/health.service.ts` | Replace `@InjectRepository(User)` with `@InjectDataSource() private readonly dataSource: DataSource`. |
| `backend/src/health/health.module.ts` | Replace `TypeOrmModule.forFeature([User])` with `TypeOrmModule.forFeature([])`. |

---

### Work Item 1.6: Fix forgotPassword HTTP Status Code (MIN-05)

**Goal:** `POST /auth/forgot-password` returns `201 Created` by default. Should return `200 OK`.

**Fix:** Add `@HttpCode(HttpStatus.OK)` to `forgotPassword()` in `AuthController`.

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/auth/auth.controller.ts` | Add `@HttpCode(HttpStatus.OK)` decorator to `forgotPassword()`. |

---

## Plan: 02-Token Security (Wave 2)

**Objective:** Eliminate all plaintext token storage. Hash refresh tokens and reset tokens with SHA-256. Implement refresh token rotation.

**Purpose:** Make good on the decision "no token stored naked in the DB" (D-06). SHA-256 is correct for high-entropy random tokens per D-05.

---

### Work Item 2.1: TokenHashService (Shared Utility)

**Goal:** Create `TokenHashService` that wraps Node.js `crypto.createHash('sha256')` with constant-time comparison. Used by both refresh token hashing and reset token hashing.

#### Files to Create

| File | Purpose |
|------|---------|
| `backend/src/auth/token-hash.service.ts` | SHA-256 hash + constant-time compare |
| `backend/src/auth/__tests__/token-hash.service.spec.ts` | Unit tests |

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/auth/auth.module.ts` | Add `TokenHashService` to `providers` array |

#### Implementation Notes

```typescript
// token-hash.service.ts
import { Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

@Injectable()
export class TokenHashService {
  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  compare(token: string, hash: string): boolean {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const bufA = Buffer.from(tokenHash);
    const bufB = Buffer.from(hash);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
```

Key notes:
- Uses `node:` prefix for built-in module import (ESM compatibility).
- `hash()` produces a hex string (64 chars for SHA-256).
- `compare()` uses `crypto.timingSafeEqual` for constant-time comparison — prevents timing side-channel attacks.
- Single `TokenHashService` used by both `SessionService` (refresh tokens) and `ResetTokenService` (reset tokens). This prevents the pitfall of "hashing on write but not on read" (Common Pitfall 1 from RESEARCH.md).

#### Test Strategy

| Test | Approach | Command |
|------|----------|---------|
| Hash is deterministic | `hash('abc')` always returns same value | `pnpm test -- token-hash` |
| Hash length is 64 hex chars | Verify output is 64 characters, all hex | `pnpm test -- token-hash` |
| Compare matches correct token | `compare(token, hash(token))` returns true | `pnpm test -- token-hash` |
| Compare rejects wrong token | `compare('wrong', hash('correct'))` returns false | `pnpm test -- token-hash` |
| Timing-safe comparison | Verify `compare` uses `timingSafeEqual` (inspect mock or verify behavior with different-length hashes) | `pnpm test -- token-hash` |
| Different inputs produce different hashes | `hash('a') !== hash('b')` | `pnpm test -- token-hash` |

---

### Work Item 2.2: Refresh Token Hashing + Soft-Delete Fix (REQ-SEC-01, CRIT-01)

**Goal:** Store SHA-256 hash of refresh tokens in the `sessions` table instead of plaintext JWTs. Also fix **CRIT-01**: soft-deleted users must not be able to authenticate (`UsersService.findByEmail()` and `findById()` use `withDeleted: true`).

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/entities/session.entity.ts` | The `refreshToken` column stays as `string`. The *value* stored changes — it becomes the SHA-256 hash of the JWT. **No schema change needed** (column type remains `varchar`/text). |
| `backend/src/auth/session.service.ts` | Inject `TokenHashService`. In `createSession()`: hash the `refreshToken` parameter before storing. In `validateRefreshToken()`: hash the incoming token before querying (change `findOne` where clause from plaintext match to hash-based lookup). |
| `backend/src/auth/auth.service.ts` | In `logout()` method (line 62-72): currently iterates sessions and compares raw `session.refreshToken === sessionToken` — this breaks because `session.refreshToken` is now a hash. Fix: iterate sessions, use `TokenHashService.compare(sessionToken, session.refreshToken)` to match. |
| `backend/src/auth/auth.controller.ts` | The `revokeAllSessions` endpoint (line ~129) has `s.refreshToken === refreshToken` — this will **always fail** once sessions store hashes. Fix: use `sessionService.validateRefreshToken()` or `TokenHashService.compare()` to match. |
| `backend/src/auth/__tests__/session.service.spec.ts` | Update `createSession` test: the `refreshToken` value stored should now be a hash. Update `validateRefreshToken` test: mock `TokenHashService.hash()` and verify it's called before `findOne`. |
| `backend/src/auth/__tests__/auth.service.spec.ts` | Update `logout` test: mock `TokenHashService.compare()` and verify the comparison logic. |
| `backend/src/users/users.service.ts` | **(CRIT-01)** Remove `withDeleted: true` from `findByEmail()` and `findById()`. Replace with `deletedAt: IsNull()` to exclude soft-deleted users. |

#### CRIT-01: Soft-Delete Bypass Fix

```typescript
// users.service.ts — fixed findByEmail
async findByEmail(email: string): Promise<User | null> {
  return this.userRepo.findOne({
    where: { email, deletedAt: IsNull() },
  });
}
```

**Impact:** Propagates to `AuthService.validateUser()`, `refreshAccessToken()`, `forgotPassword()` — all callers expect `User | null` and handle null.

#### Implementation Notes

```typescript
// session.service.ts — updated createSession
async createSession(
  userId: string,
  refreshToken: string,
  expiresAt: Date,
  userAgent?: string,
  ipAddress?: string,
  deviceInfo?: DeviceInfo,
): Promise<Session> {
  const hashedToken = this.tokenHashService.hash(refreshToken);
  const session = this.sessionRepo.create({
    user: { id: userId } as any,
    refreshToken: hashedToken,  // ← hash before storing
    expiresAt,
    userAgent: userAgent ?? null,
    ipAddress: ipAddress ?? null,
    deviceInfo: deviceInfo ?? null,
    lastActiveAt: new Date(),
  });
  return this.sessionRepo.save(session);
}
```

```typescript
// session.service.ts — updated validateRefreshToken
async validateRefreshToken(
  userId: string,
  refreshToken: string,
): Promise<Session | null> {
  const hashedToken = this.tokenHashService.hash(refreshToken);
  const session = await this.sessionRepo.findOne({
    where: { user: { id: userId }, refreshToken: hashedToken },
  });
  if (!session) return null;
  if (new Date() > session.expiresAt) {
    await this.sessionRepo.remove(session);
    return null;
  }
  session.lastActiveAt = new Date();
  return this.sessionRepo.save(session);
}
```

```typescript
// auth.service.ts — updated logout
async logout(userId: string, sessionToken?: string): Promise<void> {
  if (sessionToken) {
    const sessions = await this.sessionService.findByUserId(userId);
    const session = sessions.find((s) =>
      this.tokenHashService.compare(sessionToken, s.refreshToken),
    );
    if (session) {
      await this.sessionService.revokeSession(session.id, userId);
    }
  }
}
```

**About the `RefreshTokenGuard`:** The guard (line 36-38) calls `sessionService.validateRefreshToken(payload.sub, refreshToken)` with the *raw* JWT from the cookie. This is correct — the guard passes the raw token, and `validateRefreshToken` hashes it internally before lookup. No change needed in the guard.

**About the `revokeAllSessions` endpoint in `auth.controller.ts` (CRITICAL):** The controller has `s.refreshToken === refreshToken` (line ~129) which compares raw JWT against stored value. After hashing, this comparison **always fails**, causing ALL sessions to be deleted including the current one. Fix by replacing the comparison with `TokenHashService.compare(refreshToken, s.refreshToken)`, or better, use `sessionService.validateRefreshToken(userId, refreshToken)` to find the current session by hashed token.

Key notes:
- `compare()` in `auth.service.ts.logout()` replaces `===` with `tokenHashService.compare()`.
- The `auth.service.spec.ts` tests for `logout` need updating: the mock `Session[]` will have `refreshToken` as a hash, and the test needs to inject `TokenHashService` mock.

---

### Work Item 2.3: Reset Token Hashing (REQ-SEC-03)

**Goal:** Replace Argon2 hashing in `ResetTokenService` with SHA-256 via `TokenHashService`. Optimize `validate()` to look up by hashed token directly (currently iterates all unexpired tokens). Enforce single-use via `usedAt` check.

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/auth/reset-token.service.ts` | Replace `import * as argon2` with `TokenHashService`. In `create()`: use `this.tokenHashService.hash(rawToken)` instead of `argon2.hash(rawToken)`. In `validate()`: hash the incoming token first, then do a direct `findOne` by hashed token + `usedAt IS NULL` + `expiresAt > now` — eliminates the O(n) scan. Remove `argon2` import entirely. |
| `backend/src/auth/entities/reset-token.entity.ts` | No schema change needed — the `token` column already stores a hash string (was Argon2 hash, now SHA-256 hex). Same column type. |
| `backend/src/auth/__tests__/reset-token.service.spec.ts` | Complete rewrite of test mocks: replace `argon2` mock with `TokenHashService` mock. Update `validate()` tests for direct lookup pattern (no more iteration loop). |

#### Implementation Notes

```typescript
// reset-token.service.ts — updated
import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, IsNull, Repository } from 'typeorm';
import { ResetToken } from './entities/reset-token.entity.js';
import { TokenHashService } from './token-hash.service.js';

@Injectable()
export class ResetTokenService {
  constructor(
    @InjectRepository(ResetToken)
    private readonly repo: Repository<ResetToken>,
    private readonly configService: ConfigService,
    private readonly tokenHashService: TokenHashService,  // ← new dep
  ) {}

  async create(userId: string): Promise<{ rawToken: string }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = this.tokenHashService.hash(rawToken);  // ← SHA-256
    const expiresInMs = parseInt(
      this.configService.get('RESET_TOKEN_EXPIRATION_MS', '3600000'),
      10,
    );
    const expiresAt = new Date(Date.now() + expiresInMs);

    await this.repo.save(
      this.repo.create({
        userId,
        token: hashedToken,
        expiresAt,
      }),
    );

    return { rawToken };
  }

  async validate(token: string): Promise<ResetToken | null> {
    const hashedToken = this.tokenHashService.hash(token);  // ← hash first
    return this.repo.findOne({
      where: {
        token: hashedToken,
        usedAt: IsNull(),
        expiresAt: LessThan(new Date()),
      },
    });
  }

  async markUsed(id: string): Promise<void> {
    await this.repo.update(id, { usedAt: new Date() });
  }
}
```

**Wait — `expiresAt: LessThan(new Date())` is wrong.** The token is valid if `expiresAt > now` (not yet expired). The condition should be `expiresAt: MoreThan(new Date())`.

```typescript
import { MoreThan, IsNull, Repository } from 'typeorm';

// In validate():
async validate(token: string): Promise<ResetToken | null> {
  const hashedToken = this.tokenHashService.hash(token);
  return this.repo.findOne({
    where: {
      token: hashedToken,
      usedAt: IsNull(),
      expiresAt: MoreThan(new Date()),  // ← token is valid if not expired
    },
  });
}
```

Key notes:
- `argon2` dependency is **no longer imported** in this file. Only `TokenHashService` is needed.
- The `validate()` method changes from O(n) scan to O(1) direct lookup — a significant performance improvement.
- Combined with the `usedAt` check, this enforces single-use (REQ-SEC-03). After `markUsed()`, subsequent calls to `validate()` with the same token return null because `usedAt IS NOT NULL`.
- The `ResetToken.entity.ts` schema does not need to change — `token` column was already a string, and SHA-256 hex (64 chars) fits in any varchar/text column.

---

### Work Item 2.4: Atomic Refresh Token Rotation (REQ-SEC-02, CRIT-02)

**Goal:** Fix the race condition in `refreshAccessToken()` — current pattern is `revokeSession()` then `createSession()` in separate operations. An attacker sending two concurrent refresh requests can create infinite sessions.

**Fix:** Add `SessionService.consumeSession()` that atomically deletes the old session in a single statement. If 0 rows affected (session already consumed), abort with 401.

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/auth/session.service.ts` | Add `consumeSession(sessionId, userId)` using `repo.delete()` and checking `result.affected`. Returns boolean — true if consumed, false if already gone. |
| `backend/src/auth/auth.service.ts` | Update `refreshAccessToken()`: call `consumeSession()` first. If false, throw `UnauthorizedException`. Then generate new token pair. |
| `backend/src/auth/auth.controller.ts` | Update `refresh()`: pass sessionId from request, set new refreshToken cookie. |
| `backend/src/auth/__tests__/session.service.spec.ts` | Add tests for `consumeSession`. |
| `backend/src/auth/__tests__/auth.service.spec.ts` | Update refresh test: verify `consumeSession` called, verify old session consumed atomically. |

#### Implementation

```typescript
// session.service.ts — consumeSession (atomic)
async consumeSession(sessionId: string, userId: string): Promise<boolean> {
  const result = await this.sessionRepo.delete({
    id: sessionId,
    user: { id: userId },
  });
  return (result.affected ?? 0) > 0;
}
```

```typescript
// auth.service.ts — updated refreshAccessToken
async refreshAccessToken(userId: string, sessionId: string, ...) {
  const user = await this.usersService.findById(userId);
  if (!user) throw new UnauthorizedException('User not found');

  const consumed = await this.sessionService.consumeSession(sessionId, userId);
  if (!consumed) {
    throw new UnauthorizedException('Session already revoked');
  }

  return this.generateTokenPair(user, userAgent, ip);
}
```

**Why this fixes CRIT-02:** Two concurrent requests both pass `RefreshTokenGuard` (same cookie). Both call `consumeSession` with the same sessionId. `DELETE ... WHERE id = :id AND user = :userId` is atomic — only the first request succeeds (affected = 1). The second sees affected = 0 and gets 401.

---

### Work Item 2.5: Remove PII from JWT Payload (MAJ-08)

**Goal:** JWT access token contains `email` — PII in an unrevokable token.

**Fix:** Remove `email` from `generateAccessToken()` payload. Keep only `sub: user.id`.

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/auth/auth.service.ts` | In `generateAccessToken()`: keep only `{ sub: user.id }`. Remove `email`. |

---

### Work Item 2.6: Fix O(n) Logout to O(1) (MAJ-16)

**Goal:** `AuthService.logout()` iterates all sessions (O(n) scan). `SessionService.revokeAllSessions()` does individual `delete()` calls per session.

**Fix:** Add `findByRefreshTokenHash()` for direct DB lookup. Use batch `delete({ userId })` for revokeAll.

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/auth/session.service.ts` | Add `findByRefreshTokenHash(hash)`. Update `revokeAllSessions(userId)` to use `delete({ user: { id: userId } })`. |
| `backend/src/auth/auth.service.ts` | In `logout()`: hash incoming token, call `findByRefreshTokenHash()` for O(1) lookup. |

---

### Work Item 2.7: Pass JWT_REFRESH_EXPIRATION_MS to jwtService.sign (MIN-06)

**Goal:** `generateRefreshToken()` hardcodes `'7d'` as JWT expiry.

**Fix:** Use `configService.get('JWT_REFRESH_EXPIRATION_MS', '7d')`.

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/auth/auth.service.ts` | Replace `expiresIn: '7d'` with `expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION_MS', '7d')`. |

---

## Plan: 03-Access Control & Validation (Wave 3)

**Objective:** Protect the login endpoint from brute force and enforce password strength on registration.

---

### Work Item 3.1: Brute Force Protection (REQ-SEC-05)

**Goal:** Create `login_attempts` table + `BruteForceService` that tracks failed login attempts per-user and locks accounts after 5 failures for 15 minutes. Integrate into `AuthService.login()` and `AuthController.login()` flow.

**Implementation per D-01, D-02, D-03:**
- **D-01:** DB-based lockout using `login_attempts` table
- **D-02:** 5 failed attempts → 15-minute lockout (counter resets after expiry)
- **D-03:** Lockout scoped per-user

#### Files to Create

| File | Purpose |
|------|---------|
| `backend/src/entities/login-attempt.entity.ts` | TypeORM entity for `login_attempts` table |
| `backend/src/auth/brute-force.service.ts` | `isLocked()`, `recordFailedAttempt()`, `resetAttempts()` |
| `backend/src/auth/__tests__/brute-force.service.spec.ts` | Unit tests |

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/auth/auth.service.ts` | Add `login()` lockout check before token generation. Inject `BruteForceService`. |
| `backend/src/auth/auth.controller.ts` | Add brute force integration: catch failed login attempts and call `recordFailedAttempt()`. Reset on success. |
| `backend/src/auth/auth.module.ts` | Add `BruteForceService` to `providers`, add `TypeOrmModule.forFeature([LoginAttempt])` |
| `backend/src/entities/index.ts` | Export `LoginAttempt` |
| `backend/src/app.module.ts` | Add `LoginAttempt` to the `entities` array in `TypeOrmModule.forRootAsync()` |

#### Implementation Notes

```typescript
// login-attempt.entity.ts
@Entity('login_attempts')
@Index(['userId'])
@Index(['userId', 'createdAt'])
export class LoginAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({ default: 0 })
  failedAttempts!: number;

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil: Date | null = null;

  @CreateDateColumn()
  createdAt!: Date;
}
```

```typescript
// brute-force.service.ts
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class BruteForceService {
  constructor(
    @InjectRepository(LoginAttempt)
    private readonly repo: Repository<LoginAttempt>,
  ) {}

  async isLocked(userId: string): Promise<boolean> {
    const record = await this.repo.findOne({ where: { userId } });
    if (!record) return false;
    if (record.lockedUntil && record.lockedUntil > new Date()) return true;
    if (record.lockedUntil && record.lockedUntil <= new Date()) {
      await this.repo.delete({ userId });
    }
    return false;
  }

  async recordFailedAttempt(userId: string): Promise<void> {
    const windowStart = new Date(Date.now() - WINDOW_MS);
    let record = await this.repo.findOne({ where: { userId } });

    if (!record) {
      record = this.repo.create({ userId, failedAttempts: 1, lockedUntil: null });
    } else {
      if (record.createdAt < windowStart) {
        record.failedAttempts = 1;
        record.lockedUntil = null;
        record.createdAt = new Date();
      } else {
        record.failedAttempts += 1;
      }
    }

    if (record.failedAttempts >= MAX_ATTEMPTS) {
      record.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }

    await this.repo.save(record);
  }

  async resetAttempts(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
```

```typescript
// auth.controller.ts — updated login
@Post('login')
async login(
  @Body() dto: LoginDto,
  @Req() req: any,
  @Res({ passthrough: true }) res: Response,
) {
  // Check lockout before credential validation to avoid leaking whether user exists
  const foundUser = await this.usersService.findByEmail(dto.email);
  
  if (foundUser) {
    const locked = await this.bruteForceService.isLocked(foundUser.id);
    if (locked) {
      throw new UnauthorizedException('Account temporarily locked. Try again in 15 minutes.');
    }
  }

  const user = await this.authService.validateUser(dto.email, dto.password);
  if (!user) {
    if (foundUser) {
      await this.bruteForceService.recordFailedAttempt(foundUser.id);
    }
    throw new UnauthorizedException('Invalid credentials');
  }

  // Reset attempts on successful login
  await this.bruteForceService.resetAttempts(user.id);

  const { accessToken, refreshToken } = await this.authService.login(
    user,
    req.headers['user-agent'],
    req.ip,
  );
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  return { accessToken };
}
```

Key notes:
- Lockout check happens **before** credential validation to prevent leaking user existence via timing.
- The `foundUser` lookup is used for brute force tracking but NOT used to determine the "user not found" message (always returns "Invalid credentials").
- On-read cleanup: `isLocked()` deletes expired lockout records as a side effect. No scheduled cron needed.
- Race condition: concurrent failed requests from the same user could both read `failedAttempts = 4` and each increment to `5`, bypassing lockout. This is an acceptable tradeoff at the current scale — the race window is sub-millisecond.

#### Test Strategy

| Test | Approach | Command |
|------|----------|---------|
| isLocked returns false for new user | Mock repo.findOne returns null | `pnpm test -- brute-force` |
| 5 failed attempts triggers lockout | Call recordFailedAttempt 5x, verify lockedUntil is set | `pnpm test -- brute-force` |
| Lockout resets after window | Mock created日期 outside window, verify reset | `pnpm test -- brute-force` |
| resetAttempts clears record | Call resetAttempts, verify repo.delete called with userId | `pnpm test -- brute-force` |
| Locked user gets 401 on login | Integration: mock isLocked=true, verify UnauthorizedException | `pnpm test -- auth` |

---

> **Note (post-execution):** CSRF protection was planned here (Work Item 3.2) but later removed.
> See 01-RESEARCH.md §2 for the full correction explanation.

---

### Work Item 3.3: Password Strength Validation (REQ-SEC-06)

**Goal:** Add entropy-based password strength validation using `zxcvbn-ts`. Custom `@IsStrongPassword()` class-validator decorator on `RegisterDto.password`. Additional service-layer check with user-specific inputs (email, name) for scoring.

**Implementation per D-08 (deferred to implementation discussion — resolved: zxcvbn-ts with score >= 3).**

#### Files to Create

| File | Purpose |
|------|---------|
| `backend/src/auth/validators/is-strong-password.validator.ts` | Custom `@IsStrongPassword()` class-validator decorator |
| `backend/src/auth/__tests__/validators/is-strong-password.spec.ts` | Unit tests for the decorator |

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/auth/dto/register.dto.ts` | Import `IsStrongPassword` decorator, add `@IsStrongPassword()` above the `password` field |
| `backend/src/auth/auth.service.ts` | In `register()`: add cross-field zxcvbn check with `[dto.email, dto.name]` as user inputs for scoring. If score < 3, throw `BadRequestException`. |
| `backend/src/auth/__tests__/register.dto.spec.ts` | Add test: weak password (score < 3) triggers validation error. |
| `backend/src/auth/__tests__/auth.service.spec.ts` | Add test: weak password with user inputs triggers BadRequestException in register() |

#### Implementation Notes

```typescript
// is-strong-password.validator.ts
import { registerDecorator, type ValidationOptions } from 'class-validator';
import { zxcvbn } from 'zxcvbn-ts';

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: {
        message: 'Password is not strong enough (try a longer password or passphrase)',
        ...validationOptions,
      },
      validator: {
        validate(value: string) {
          if (typeof value !== 'string') return false;
          const result = zxcvbn(value);
          return result.score >= 3;
        },
      },
    });
  };
}
```

```typescript
// register.dto.ts — updated
import { IsStrongPassword } from '../validators/is-strong-password.validator.js';

export class RegisterDto {
  // ... email field (unchanged) ...

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @IsStrongPassword()
  password!: string;

  // ... name field (unchanged) ...
}
```

```typescript
// auth.service.ts — updated register()
async register(dto: RegisterDto) {
  const existing = await this.usersService.findByEmail(dto.email);
  if (existing) throw new ConflictException('Email already in use');

  // Cross-field password strength validation with user-specific inputs
  const result = zxcvbn(dto.password, [dto.email, dto.name ?? '']);
  if (result.score < 3) {
    throw new BadRequestException(
      `Password is not strong enough. ${result.feedback.suggestions.join(' ')}`,
    );
  }

  const passwordHash = await this.hashService.hashPassword(dto.password);
  const user = await this.usersService.create({
    email: dto.email,
    passwordHash,
    name: dto.name,
  });

  return this.generateAuthResponse(user);
}
```

Key notes:
- **Two layers of validation:** DTO-level (class-validator decorator) catches weak passwords before they reach the service. Service-level catches weak passwords that include user-specific info (email, name) for scoring.
- **Score threshold: 3 (safely unguessable).** Score 4 rejects good passphrases like "correct-horse-battery-staple". Per RESEARCH.md §3, score >= 3 is the standard cutoff.
- The DTO-level decorator runs first and provides a generic message. The service-level check runs second and provides specific feedback (from `zxcvbn.feedback.suggestions`).
- `@MinLength(8)` remains alongside `@IsStrongPassword()` — handles the empty string edge case.

#### Test Strategy

| Test | Approach | Command |
|------|----------|---------|
| Strong password passes decorator | `validate()` on RegisterDto with `Tr0ub4dor&3` → 0 errors | `pnpm test -- register.dto` |
| Weak password fails decorator | `validate()` on RegisterDto with `password` → 1 error on `password` field | `pnpm test -- register.dto` |
| Service layer rejects weak password | Mock zxcvbn score 2, call register, verify BadRequestException | `pnpm test -- auth` |
| Service layer accepts strong password | Mock zxcvbn score 3, call register, verify success | `pnpm test -- auth` |
| User-specific inputs penalized | Mock zxcvbn with `[email, name]`, verify called with correct args | `pnpm test -- auth` |

#### Dependencies

| Type | Item |
|------|------|
| Package install | `pnpm add zxcvbn-ts --filter backend` |
| Package verification | `zxcvbn-ts` [ASSUMED] per RESEARCH.md |

---

### Work Item 3.4: Increase Argon2 Memory Cost (MAJ-06)

**Goal:** `HashService.hashPassword()` uses argon2 defaults (memory cost 19 = 2 MiB).

**Fix:** Pass explicit `memoryCost: 37888` (~37 MiB) to `argon2.hash()`.

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/auth/hash.service.ts` | Add `memoryCost: 37888` to `argon2.hash()` options. |

```typescript
async hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 37888,  // ~37 MiB (OWASP recommended)
    timeCost: 2,
    parallelism: 1,
  });
}
```

---

### Work Item 3.5: Fix Rate Limiting on Password Endpoints (MIN-04)

**Goal:** Tighten rate limits on password-related endpoints.

**Fix:** Add explicit `@Throttle()` decorators: `forgotPassword` → 3 req/60s, `resetPassword` → 5 req/60s.

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/auth/auth.controller.ts` | Add `@Throttle({ default: { limit: 3, ttl: 60000 } })` to `forgotPassword()`. Add `@Throttle({ default: { limit: 5, ttl: 60000 } })` to `resetPassword()`. |

---

## Plan: 04-Audit & Polish (Wave 4)

**Objective:** Audit policy objects for gaps, write comprehensive tests, generate TypeORM migrations for new entities.

---

### Work Item 4.1: Policy Audit (REQ-SEC-07)

**Goal:** Review all 4 policy objects (ProductPolicy, OrderPolicy, CartPolicy, SellerProfilePolicy) for authorization gaps. Fix identified issues. Write extended tests covering edge cases.

#### Gap Analysis (from source code review)

| Policy | Current State | Gaps | Fix |
|--------|---------------|------|-----|
| **ProductPolicy** | `canEdit()` checks ownership/admin. `canView()` checks active/admin/owner. | `canView(null, product)` has unsafe `user!` assertion when user is null (line 21: `this.isAdmin(user!))` — crashes on null user for inactive product. | Add null check at start of `canView()`: if user is null, return `product.isActive` only. |
| **OrderPolicy** | `canView()` checks ownership/admin. `canEdit()` checks ownership + pending status. | No `canCancel()` method that allows cancellation only in pending/confirmed states. No `canUpdateStatus()` for admin. | Add `canCancel(user, order)` method. `canUpdateStatus()` is admin-only — handled by `RolesGuard`, not policy. |
| **CartPolicy** | `canEdit()` and `canView()` check ownership/admin. | No `canClear()` for cart clearing. No `canRemoveItem()` — check if user owns the cart before removing items. | `canClear()` reuses `canEdit()`. No change needed — `canEdit` covers all cart mutations. |
| **SellerProfilePolicy** | `canEdit()` checks ownership/admin. `canView()` returns true for everyone. | No `canCreate()` check — should verify user is seller (role === SELLER). Currently any role could create a profile. | Add `canCreate(user)` that checks `user.role === UserRole.SELLER \|\| isAdmin(user)`. |
| **BasePolicy** | Provides `isAdmin()` helper. | No role-check helpers. | Add `hasRole(user, role)` helper? **Deferred** — not needed for this phase. |

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/auth/policies/product.policy.ts` | Fix null user crash in `canView()`: early-return `product.isActive` when user is null |
| `backend/src/auth/policies/seller-profile.policy.ts` | Add `canCreate(user)` method checking seller role or admin |
| `backend/src/auth/policies/order.policy.ts` | Add `canCancel(user, order)` method (cancellable when pending or confirmed) |

#### Files to Create

| File | Purpose |
|------|---------|
| `backend/src/auth/policies/__tests__/product-policy-extended.spec.ts` | Test null user edge case for canView |
| `backend/src/auth/policies/__tests__/order-policy-extended.spec.ts` | Test canCancel with various order states |
| (Use extended test files to avoid modifying existing tests that may have known passing expectations) | |

#### Implementation Notes

```typescript
// product.policy.ts — fixed canView
canView(user: User | null, product: ProductLike): boolean {
  if (product.isActive) return true;
  if (!user) return false;  // ← must return false for unauthenticated viewing inactive
  if (this.isAdmin(user)) return true;
  const ownerId = product.sellerId ?? product.seller?.id;
  return user.id === ownerId;
}
```

```typescript
// seller-profile.policy.ts — added canCreate
canCreate(user: User): boolean {
  if (this.isAdmin(user)) return true;
  return user.role === UserRole.SELLER;
}
```

```typescript
// order.policy.ts — added canCancel
canCancel(user: User, order: OrderLike): boolean {
  if (this.isAdmin(user)) return true;
  const ownerId = order.userId ?? order.user?.id;
  if (user.id !== ownerId) return false;
  return order.status === 'pending' || order.status === 'confirmed';
}
```

Key notes:
- The `product.policy.ts` null user bug is a **runtime crash** — calling `canView(null, inactiveProduct)` would throw `TypeError: Cannot read properties of null (reading 'role')` at `this.isAdmin(user!)`.
- `SellerProfilePolicy.canCreate()` fills a gap where any user role could currently create a seller profile. Now restricted to `SELLER` or `ADMIN`.
- Extended test files use a different name pattern from the existing tests (no file name collision).

#### Test Strategy

| Test | Approach | Command |
|------|----------|---------|
| ProductPolicy: null user can view active | Call `canView(null, activeProduct)` → true | `pnpm test -- product-policy-extended` |
| ProductPolicy: null user CANNOT view inactive | Call `canView(null, inactiveProduct)` → false (previously crashed) | `pnpm test -- product-policy-extended` |
| SellerProfilePolicy: non-seller cannot create | Call `canCreate(customerUser)` → false | `pnpm test -- seller-profile` |
| SellerProfilePolicy: seller can create | Call `canCreate(sellerUser)` → true | `pnpm test -- seller-profile` |
| OrderPolicy: canCancel returns true for pending | `canCancel(owner, { status: 'pending' })` → true | `pnpm test -- order-policy-extended` |
| OrderPolicy: canCancel returns false for shipped | `canCancel(owner, { status: 'shipped' })` → false | `pnpm test -- order-policy-extended` |

---

### Work Item 4.2: Migration Generation

**Goal:** Generate TypeORM migration for the new `login_attempts` table.

#### Files to Create (generated by TypeORM CLI)

| File | Purpose |
|------|---------|
| `backend/src/migrations/XXXXXXXXXXXX-CreateLoginAttemptsTable.ts` | Migration for `login_attempts` table |

#### Implementation

```bash
# From backend/ directory
pnpm migration:generate -- src/migrations/CreateLoginAttemptsTable
```

Key notes:
- The migration generates automatically based on the `LoginAttempt` entity added to `TypeOrmModule.forRootAsync()` entities list.
- The `sessions` table and `reset_tokens` table do NOT need schema changes — the `refreshToken` and `token` columns remain as string columns. Only the *values* stored change (from plaintext/JWT to SHA-256 hash).
- Run the migration after generation: `pnpm migration:run`

---

### Work Item 4.3: E2E Tests

**Goal:** Write comprehensive E2E tests for the new security features. Test the complete security flow.

#### Files to Create

| File | Purpose |
|------|---------|
| `backend/src/test/security.e2e-spec.ts` | E2E tests covering brute force, password strength, refresh token hashing, health endpoint |

#### E2E Test Scenarios

| Scenario | Steps | Expected |
|----------|-------|----------|
| Health endpoint | GET /health | Returns 200 with DB status, uptime, memory |
| Brute force lockout | POST /auth/login with wrong password 5x | 401, then account locked for 15 min |
| Password strength on register | POST /auth/register with weak password | 400 Bad Request |
| Refresh token rotation | Login, then refresh twice, old refresh cookie should not work | First refresh works, second refresh gets 401 |

Note: E2E tests require `pnpm test:e2e` which uses `docker compose` to start a test PostgreSQL instance. The setup needs the test database to have run migrations.

---

### Work Item 4.4: Remove RefreshTokenGuard from Non-Refresh Endpoints (MAJ-12)

**Goal:** Class-level `@UseGuards(RefreshTokenGuard)` on `AuthController` fires on login/register unnecessarily.

**Fix:** Remove class-level guard. Apply `RefreshTokenGuard` only to `refresh()`. Use `JwtAuthGuard` for `logout()`.

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/auth/auth.controller.ts` | Remove class-level `@UseGuards(RefreshTokenGuard)`. Add `@UseGuards(RefreshTokenGuard)` only on `refresh()`. Change `logout()` to use `JwtAuthGuard`. |

---

### Work Item 4.5: Fix reset_tokens.userId FK Constraint (MAJ-10)

**Goal:** `reset-token.entity.ts` has `userId` as plain `@Column()` with no FK constraint.

**Fix:** Change to `@ManyToOne(() => User, { onDelete: 'CASCADE' })` with `@JoinColumn({ name: 'userId' })`. Keep `@Column() userId` for direct queries. Generate migration.

#### Files to Modify

| File | Required Changes |
|------|-----------------|
| `backend/src/auth/entities/reset-token.entity.ts` | Add `@ManyToOne` + `@JoinColumn` for FK constraint. |

#### Migration

```bash
pnpm migration:generate -- src/migrations/AddResetTokensUserIdFK
pnpm migration:run
```

---

### Work Item 4.6: Unit Tests for Untested Security Code (MAJ-14)

**Goal:** Add unit tests for `RolesGuard`, `JwtStrategy`, `AuthController`, `LoginDto`, `ForgotPasswordDto`, `ResetPasswordDto`.

#### Files to Create

| File | Purpose |
|------|---------|
| `backend/src/auth/__tests__/roles-guard.spec.ts` | RolesGuard tests |
| `backend/src/auth/__tests__/jwt-strategy.spec.ts` | JwtStrategy tests |
| `backend/src/auth/__tests__/auth.controller.spec.ts` | AuthController delegate tests |
| `backend/src/auth/__tests__/login.dto.spec.ts` | LoginDto validation |
| `backend/src/auth/__tests__/forgot-password.dto.spec.ts` | ForgotPasswordDto validation |
| `backend/src/auth/__tests__/reset-password.dto.spec.ts` | ResetPasswordDto validation |

---

## Dependency Graph

```
TokenHashService (2.1)
  ├── Refresh Token Hashing + Soft-Delete Fix (2.2) — uses TokenHashService.hash/compare
  ├── Reset Token Hashing (2.3) — uses TokenHashService.hash
  ├── Atomic Rotation (2.4) — builds on 2.2 (sessionService hashing in place)
  ├── Remove PII from JWT (2.5) — modifies generateAccessToken in auth.service.ts
  ├── Fix O(n) Logout (2.6) — modifies logout in auth.service.ts + session.service.ts
  └── Configurable JWT Expiry (2.7) — modifies generateRefreshToken
  
EmailModule Timing Fix (1.4)
  └── Runs after Email integration (1.3) — modifies same file

Health Coupling Fix (1.5)
  └── Runs after Health endpoint (1.2) — modifies same files

forgotPassword HttpCode (1.6)
  └── Runs after Email integration (1.3) — modifies auth.controller.ts

Brute Force (3.1)
  └── Integrates into AuthController.login (modifies same file as 2.4-2.7)

Password Strength (3.2)
  └── Independent — only touches RegisterDto and auth.service.ts

Argon2 Memory Cost (3.4)
  └── Independent — only touches hash.service.ts

Rate Limits (3.5)
  └── Modifies auth.controller.ts — sequenced after 3.1-3.3

Policy Audit (4.1)
  └── Independent — only touches policy files

Guard Scope Fix (4.4)
  └── Modifies auth.controller.ts — sequenced after all other auth controller changes

Reset Token FK (4.5)
  └── Entity change + migration — sequenced after all entity changes settled

Security Tests (4.6)
  └── Must be after 2.2-2.7, 3.1-3.5, 4.4 (tests verify integrated behavior)
```

## Security Threat Model

### Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → API (HTTP) | Untrusted requests cross this boundary. Brute force, weak passwords enter here. |
| API → Database | Stored tokens cross this boundary. Plaintext tokens are a storage vulnerability. |

### STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation |
|-----------|----------|-----------|-------------|------------|
| T-01-01 | Spoofing | Auth/login | mitigate | Brute force protection (5 attempts → 15 min lockout) |
| T-01-03 | Info Disclosure | Session/reset tokens | mitigate | SHA-256 hashing of all stored tokens |
| T-01-04 | Elevation | Register DTO | mitigate | zxcvbn-ts password strength enforcement |
| T-01-05 | Spoofing | Auth/refresh | mitigate | Token rotation — revoke old session on refresh |
| T-01-06 | Info Disclosure | Logs | mitigate | Pino PII redaction (password, token, authorization) |
| T-01-07 | Tampering | Health endpoint | accept | No sensitive data exposed; read-only diagnostic endpoint |
| T-01-08 | Tampering | npm packages (zxcvbn-ts, nestjs-pino, pino-http, resend) | mitigate | Package legitimacy verified in RESEARCH.md Package Legitimacy Audit — all [OK] |
| T-01-10 | Info Disclosure | Email service | accept | DevEmailService logs to console only; Resend uses TLS. In production, RESEND_API_KEY must be set |

## Verification

See `VERIFICATION.md` for detailed goal-backward verification criteria.

## Success Criteria

| Criterion | How to Verify |
|-----------|---------------|
| [ ] No token stored as plaintext in any database table | Query `sessions.refreshToken` and `reset_tokens.token` — values must be 64-char hex strings (SHA-256), not JWTs or raw hex |
| [ ] Health endpoint returns DB status | `curl localhost:3001/health` returns JSON with `database: 'ok'` |
| [ ] Health module not coupled to User entity | HealthService uses `DataSource`, not `@InjectRepository(User)` |
| [ ] Brute force lockout works | 5 failed logins in 15 min → account locked |
| [ ] Weak passwords rejected on registration | POST register with `password: 'password'` → 400 |
| [ ] Refresh token rotation invalidates old token | Login → refresh twice → second refresh returns 401 |
| [ ] Refresh token race condition prevented | 2 concurrent refresh requests → only 1 succeeds |
| [ ] Soft-deleted user cannot authenticate | Soft-delete user → login attempt → 401 |
| [ ] JWT payload contains no PII | Decode access token — only `sub` present, no `email` |
| [ ] Argon2 uses production memory cost | Verify `memoryCost: 37888` passed to argon2.hash() |
| [ ] EmailModule uses factory provider | Set NODE_ENV=test, verify DevEmailService provided |
| [ ] forgotPassword returns 200 not 201 | POST /auth/forgot-password → 200 OK |
| [ ] forgotPassword rate limited to 3/60s | 4th call in 1 minute → 429 |
| [ ] reset_tokens.userId has FK constraint | `information_schema` shows FK on `reset_tokens.userId` |
| [ ] RefreshTokenGuard only on refresh endpoint | POST /auth/login without refresh cookie succeeds |
| [ ] All untested security code has unit tests | `RolesGuard`, `JwtStrategy`, `AuthController`, DTOs all have spec files |
| [ ] All unit tests pass | `pnpm test` from `backend/` — green |
| [ ] All E2E tests pass | `pnpm test:e2e` from `backend/` — green |
| [ ] Coverage maintained >= 80% | `pnpm test:cov` from `backend/` — lines/functions/branches/statements all >= 80% |
| [ ] Policy gap fixes deployed | Null user crash fixed, `canCreate` added for seller profiles, `canCancel` added for orders |
| [ ] Email integration wired | DevEmailService logs password reset email instead of raw console.log |
| [ ] Pino logs structured JSON | Dev: pretty-print. Prod: JSON lines to stdout. Sensitive fields redacted. |

## Phase 01B (Next): Data Integrity & Observability

The following review findings touch files never modified by Phase 01 plans. They form an immediately-next phase (01B):

| Priority | Item | Focus | Files |
|----------|------|-------|-------|
| P0 | CRIT-05 | E2E in CI workflow | `.github/workflows/*.yml` |
| P0 | MAJ-01 | Global exception filter | New file `src/common/filters/global-exception.filter.ts` + main.ts |
| P0 | MAJ-02 | DB transactions on multi-entity writes | `auth.service.ts`, `users.service.ts`, `session.service.ts` |
| P0 | MAJ-03 | FK indexes on 12 relationships | All entity files |
| P0 | MAJ-04 | PoliciesGuard Service Locator → DI | `policies.guard.ts`, policy files |
| P0 | MAJ-11 | Optimistic locking on inventory | `inventory.entity.ts` |
| P0 | MAJ-13 | Remove HTTP exceptions from service layer | `hash.service.ts`, `users.service.ts` |
| P1 | MIN-01 | Remove dead `@Public()` or implement bypass | `public.decorator.ts` |
| P1 | MIN-02 | Remove dead `RefreshDto` | `refresh.dto.ts` |
| P1 | MIN-08 | Fix/remove stale `app.e2e-spec.ts` | `test/app.e2e-spec.ts` |
| P1 | MIN-09 | Fix E2E state coupling | `test/*.e2e-spec.ts` |
| P1 | MIN-10 | Shared E2E test helper | `test/helpers/` |
| P1 | MIN-11 | `RolesGuard implements CanActivate` | `roles.guard.ts` |
| P1 | MIN-12 | Add missing env vars to validation schema | `env.validation.ts` |
| P1 | MIN-13 | Fix Biome `useImportType` | `biome.json` |
| P1 | MIN-14 | Fix parseDeviceInfo Safari detection | `device-info.util.ts` |
| P2 | MAJ-15 | Fix coverage thresholds | `vitest.config.ts` |
| P2 | MIN-15 | Add `tsc --noEmit` to pre-commit | `lefthook.yml` |

See `./01B-CONTEXT.md` for the detailed 01B plan.

---

## Implementation Sequence

The recommended execution order within the phase:

1. **Install all packages first** (single batch install): `pnpm add nestjs-pino pino-http pino-pretty resend zxcvbn-ts --filter backend`
2. **Wave 1 tasks** (Pino → Health → Email → 1.4 EmailModule fix → 1.5 Health coupling fix → 1.6 forgotPassword HttpCode)
3. **Create TokenHashService** (shared utility) + **2.7** (configurable JWT expiry)
4. **Wave 2 tasks** (2.2 Session hashing + soft-delete fix → 2.3 Reset token hashing → 2.4 Atomic rotation → 2.5 Remove PII → 2.6 O(n) logout fix)
5. **Wave 3 tasks** (3.1 Brute force → 3.2 Password strength → 3.3 Argon2 cost → 3.4 Rate limits)
6. **Wave 4 tasks** (4.1 Policy audit → 4.2 Migrations → 4.3 E2E tests → 4.4 Guard scope → 4.5 Reset token FK → 4.6 Security tests)
7. **Final verification** — `pnpm test`, `pnpm test:cov`, `pnpm test:e2e`
