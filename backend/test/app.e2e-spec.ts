import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing/test";
import request from "supertest";
import { afterAll, beforeAll, describe, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { PoliciesGuard } from "../src/auth/guards/policies.guard.js";

describe("AppController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PoliciesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe("AppController (e2e)", () => {
    it("/ (GET)", () => {
      return request(app.getHttpServer())
        .get("/")
        .expect(200)
        .expect("Hello World!");
    });
  });
});
