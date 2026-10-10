# Testing

**Analysis Date:** 2026-06-15

## Test Framework

- **Vitest** 4.1.6 — Unit and E2E test runner
- **@vitest/coverage-v8** 4.1.6 — V8-based coverage provider
- **Supertest** 7.0.0 — HTTP integration testing

## Configuration

| Config File | Purpose |
|-------------|---------|
| `backend/vitest.config.ts` | Unit test config |
| `backend/vitest.e2e.config.ts` | E2E test config |

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
- No coverage thresholds configured in vitest configs

## Running Tests

| Command | What |
|---------|------|
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | E2E tests |
| `pnpm test:cov` | Coverage report |

## CI Quirk
- `src/data-source.ts` uses `__dirname` globs pointing to `src/`. In CI, paths need to change to `dist/`

---

*Testing analysis: 2026-06-15*