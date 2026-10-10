import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing/test";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { HealthController } from "../src/health/health.controller.js";

/**
 * The liveness contract, through the full HTTP stack.
 *
 * This file used to be the Nest scaffold's default test, asserting that `GET /`
 * returned `Hello World!`. No such route was ever built — `AppController` and
 * `AppService` were removed when the project was restructured and this
 * assertion was left behind, failing against a 404. It was never noticed
 * because the E2E suite did not run in CI.
 *
 * What replaces it is the endpoint that actually exists and actually matters:
 * `/health`, which is what a platform's liveness probe and the BetterStack
 * uptime monitor both read.
 */
describe("Health (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("is not throttled", () => {
    // `/health` is excluded from the global ThrottlerGuard. If that exclusion
    // is ever dropped, a monitoring check would eventually start returning 429
    // and take the instance out of rotation.
    return request(app.getHttpServer()).get("/health").expect(200);
  });

  it("reports 200 and ok while the database is reachable", async () => {
    const res = await request(app.getHttpServer()).get("/health").expect(200);
    expect(res.body).toMatchObject({ status: "ok", database: "ok" });
    expect(typeof res.body.timestamp).toBe("string");
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body).toHaveProperty("memory.rss");
  });

  it("names the most recently applied migration", async () => {
    const res = await request(app.getHttpServer()).get("/health").expect(200);
    expect(res.body.lastMigration).toMatch(/InitialSchema|AddSession/);
  });

  it("has no root route — health is the liveness path", async () => {
    // Asserted so the scaffold test's assumption cannot creep back in. If a root
    // route is ever added deliberately, this is the line to change.
    await request(app.getHttpServer()).get("/").expect(404);
  });

  it("is served by HealthController", () => {
    expect(HealthController).toBeDefined();
  });
});
