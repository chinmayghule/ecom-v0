# Conventions

**Analysis Date:** 2026-06-15

## Code Style

- **Language:** TypeScript 5.7 with strict mode
- **Module system:** ES Modules (`"type": "module"` in package.json)
- **Linter/Formatter:** Biome (configured in root `biome.json`)
- **Pre-commit:** Lefthook runs `pnpm biome check --staged`
- **Imports:** Explicit `.js` extensions in all relative imports (e.g., `./app.module.js`)

## Naming

| Category | Convention | Example |
|----------|-----------|---------|
| Files | `kebab-case` | `jwt.strategy.ts` |
| Test files | `snake_case` | `auth.service.spec.ts` |
| Classes | `PascalCase` | `AuthService` |
| Methods | `camelCase` | `findByEmail()` |
| Constants | `UPPER_SNAKE_CASE` | `JWT_ACCESS_EXPIRATION_MS` |
| Enums | `PascalCase` enum, `UPPER_SNAKE_CASE` members | `UserRole.CUSTOMER` |
| Interfaces | `PascalCase` with `I` prefix | `PolicyHandler` (note: no `I` prefix) |
| Entity columns | `camelCase` | `passwordHash`, `contactNumber` |
| DTO fields | `camelCase` | `email`, `password` |

## File Organization

- **Module-scoped:** Each feature module is a directory with its own module, controller, service, DTOs, guards, tests
- **Shared entities:** All domain entities live in `src/entities/` (shared kernel pattern)
- **Test proximity:** Tests in `__tests__/` directory next to source, not a separate `tests/` dir

## Patterns

### Module Structure
```typescript
@Module({
  imports: [/* feature-specific imports */],
  controllers: [/* feature controllers */],
  providers: [/* feature services, guards */],
  exports: [/* services to share */],
})
export class FeatureModule {}
```

### Async Configuration
```typescript
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({ /* config */ }),
  inject: [ConfigService],
})
```

### Guards
- Global: `ThrottlerGuard` (rate limiting) registered in `AppModule`
- Class/method-level: `JwtAuthGuard`, `RolesGuard`, `PoliciesGuard`, `RefreshTokenGuard`
- Admin bypass: `ADMIN` role bypasses `RolesGuard` entirely
- Public routes: `@Public()` decorator skips JWT auth

### Policy-Based Authorization
- `BasePolicy` abstract class with `can(user, resource, action)` method
- Per-resource policies extend `BasePolicy`
- `PoliciesGuard` executes policies declared via `@CheckPolicies()`

### Error Handling
- Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`
- `ForbiddenException` for authorization failures
- Standard NestJS exception filters (no custom exception filters yet)

## Dependencies
- Adding deps: `pnpm add <pkg> --filter backend`
- No `npm install` or bare `pnpm add`

## Environment
- Global `.env` at repo root loaded by both `@nestjs/config` (runtime) and `dotenv` (TypeORM CLI via `src/data-source.ts`)
- `.env.local` for secrets (gitignored)
- `.env.test` for test configuration

---

*Conventions analysis: 2026-06-15*