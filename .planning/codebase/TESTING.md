# Testing

**Snapshot: 2026-06-15 — corrected 2026-10-10.** This listed two config files.
There are **three**: the integration suite and its config were added since.

## Test Framework

- **Vitest** 4.1.6 — Unit, integration, and E2E test runner
- **@vitest/coverage-v8** 4.1.6 — V8-based coverage provider
- **Supertest** 7.0.0 — HTTP integration testing

## Configuration

Three configs, three suites. They are separate because they need different
environments: unit tests mock every repository, integration tests need a real
Postgres, and E2E needs the whole `AppModule` booted.

| Config File | Suite | Needs a database? |
|-------------|-------|--------------------|
| `backend/vitest.config.ts` | Unit — `src/**/__tests__/*.spec.ts` | No, repositories mocked |
| `backend/vitest.integration.config.ts` | Integration — `src/integration/*.spec.ts` | **Yes**, real Postgres |
| `backend/vitest.e2e.config.ts` | E2E — `test/*.e2e-spec.ts` | **Yes**, real Postgres + full app |

Integration specs (6 files): `brute-force`, `catalog`, `rbac-policies`,
`register-soft-delete`, `reset-token`, `session`.

```bash
pnpm test              # unit
pnpm test:integration  # real Postgres on 5433
pnpm test:e2e          # full app, supertest
pnpm test:cov          # unit + coverage
```

CI runs all three as separate steps, plus a migration smoke check.

## Test Structure

### Unit Tests
Tests live in `__tests__/` directories co-located with source:
```
src/auth/__tests__/
├── auth.service.spec.ts
├── hash.service.spec.ts
├── session.service.spec.ts
├── reset-token.service.spec.ts
└── register.dto.spec.ts

src/auth/guards/__tests__/
└── refresh-token.guard.spec.ts

src/auth/policies/__tests__/
├── product-policy.spec.ts
├── order-policy.spec.ts
├── cart-policy.spec.ts
└── seller-profile-policy.spec.ts

src/users/__tests__/
└── users.service.spec.ts
```

### E2E Tests
```
backend/test/
├── setup.e2e.ts      # Test setup (migrations, dataSource)
├── app.e2e-spec.ts    # App health check E2E
└── auth.e2e-spec.ts   # Auth flow E2E
```

## Test Patterns

### Unit Test Pattern
```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";

describe("ServiceName", () => {
  let service: ServiceName;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceName,
        {
          provide: getRepositoryToken(EntityName),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
  });

  it("should do something", async () => {
    // test logic
  });
});
```

### E2E Test Pattern
```typescript
import request from "supertest";
import { Test, TestingModule } from "@nestjs/testing";

describe("Feature (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Apply global middleware
    await app.init();
  });

  it("GET /endpoint", () => {
    return request(app.getHttpServer())
      .get("/endpoint")
      .expect(200);
  });
});
```

## Mocking

- TypeORM repositories mocked via `getRepositoryToken` + `useValue` / `useFactory`
- No external mocking libraries (e.g., no `jest.mock` equivalent patterns yet)
- Services provided directly to test modules

## Coverage

- Provider: `@vitest/coverage-v8`
- Output: `backend/coverage/`
- No coverage thresholds configured in vitest configs — still true, and tracked as TL-01 in Phase 03 (01B item MAJ-15: the 80% threshold is unrealistic and unenforced)

## Running Tests

| Command | What |
|---------|------|
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | E2E tests |
| `pnpm test:cov` | Coverage report |

## CI Quirk
- `src/data-source.ts` uses `__dirname` globs pointing to `src/`. In CI, paths need to change to `dist/`

---

*Testing analysis: 2026-06-15. Config table and commands corrected 2026-10-10.*