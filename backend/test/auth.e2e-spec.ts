import { createHash } from "node:crypto";
import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module.js";
import { PoliciesGuard } from "../src/auth/guards/policies.guard.js";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PoliciesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = app.get(DataSource);
    await dataSource.query(`DELETE FROM sessions`);
    await dataSource.query(`DELETE FROM users`);
  });

  afterAll(async () => {
    await dataSource?.query(`DELETE FROM sessions`);
    await dataSource?.query(`DELETE FROM users`);
    await app?.close();
  });

  const testUser = {
    email: "e2e-test@example.com",
    password: "StrongPass123!",
    name: "E2E Test User",
  };

  const getServer = () => app.getHttpServer();

  describe("POST /auth/register", () => {
    it("registers a new user", async () => {
      const res = await request(getServer())
        .post("/auth/register")
        .send(testUser)
        .expect(201);

      expect(res.body).toEqual({ accessToken: expect.any(String) });
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find((c: string) =>
        c.startsWith("refreshToken="),
      );
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain("HttpOnly");
      expect(refreshCookie).toContain("Path=/");
    });

    it("rejects duplicate email", async () => {
      await request(getServer())
        .post("/auth/register")
        .send(testUser)
        .expect(409);
    });

    it("rejects invalid email", async () => {
      await request(getServer())
        .post("/auth/register")
        .send({ email: "not-an-email", password: "StrongPass123!" })
        .expect(400);
    });

    it("rejects short password", async () => {
      await request(getServer())
        .post("/auth/register")
        .send({ email: "short@example.com", password: "123" })
        .expect(400);
    });
  });

  describe("POST /auth/login", () => {
    it("logs in with valid credentials", async () => {
      const res = await request(getServer())
        .post("/auth/login")
        .send({ email: testUser.email, password: testUser.password })
        .expect(201);

      expect(res.body).toEqual({ accessToken: expect.any(String) });

      const cookies = res.headers["set-cookie"];
      const refreshCookie = cookies.find((c: string) =>
        c.startsWith("refreshToken="),
      );
      expect(refreshCookie).toBeDefined();
    });

    it("rejects wrong password", async () => {
      await request(getServer())
        .post("/auth/login")
        .send({ email: testUser.email, password: "WrongPassword!" })
        .expect(401);
    });

    it("rejects nonexistent email", async () => {
      await request(getServer())
        .post("/auth/login")
        .send({ email: "nobody@example.com", password: "SomePass123!" })
        .expect(401);
    });

    it("rejects missing fields", async () => {
      await request(getServer())
        .post("/auth/login")
        .send({ email: testUser.email })
        .expect(400);
    });
  });

  describe("POST /auth/refresh", () => {
    it("refreshes access token with valid cookie", async () => {
      const loginRes = await request(getServer())
        .post("/auth/login")
        .send({ email: testUser.email, password: testUser.password });

      const cookies = loginRes.headers["set-cookie"];

      const res = await request(getServer())
        .post("/auth/refresh")
        .set("Cookie", cookies)
        .expect(201);

      expect(res.body).toEqual({ accessToken: expect.any(String) });
    });

    it("returns 401 without cookie", async () => {
      await request(getServer()).post("/auth/refresh").expect(401);
    });
  });

  describe("POST /auth/logout", () => {
    it("logs out successfully", async () => {
      const loginRes = await request(getServer())
        .post("/auth/login")
        .send({ email: testUser.email, password: testUser.password });

      const accessToken = loginRes.body.accessToken;
      const cookies = loginRes.headers["set-cookie"];

      const _res = await request(getServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Cookie", cookies)
        .expect(204);

      // 204 carries no body. It previously returned 201 with a message, which
      // told the client something it did not need to know.
    });

    it("returns 401 without token", async () => {
      await request(getServer()).post("/auth/logout").expect(401);
    });
  });

  describe("GET /auth/me", () => {
    it("returns the current user profile", async () => {
      const loginRes = await request(getServer())
        .post("/auth/login")
        .send({ email: testUser.email, password: testUser.password });

      const cookies = loginRes.headers["set-cookie"];

      const res = await request(getServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${loginRes.body.accessToken}`)
        .set("Cookie", cookies)
        .expect(200);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        email: testUser.email,
        name: testUser.name,
        role: "customer",
      });
      expect(res.body).not.toHaveProperty("passwordHash");
    });

    it("returns 401 without token", async () => {
      await request(getServer()).get("/auth/me").expect(401);
    });
  });

  describe("Session management", () => {
    let accessToken: string;
    let cookies: string[];

    beforeEach(async () => {
      const loginRes = await request(getServer())
        .post("/auth/login")
        .send({ email: testUser.email, password: testUser.password });

      accessToken = loginRes.body.accessToken;
      cookies = loginRes.headers["set-cookie"];
    });

    it("GET /auth/sessions lists sessions", async () => {
      const res = await request(getServer())
        .get("/auth/sessions")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Cookie", cookies)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        createdAt: expect.any(String),
      });
    });

    it("DELETE /auth/sessions/:id revokes a session", async () => {
      const sessionsRes = await request(getServer())
        .get("/auth/sessions")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Cookie", cookies);

      const sessionId = sessionsRes.body[0].id;

      const res = await request(getServer())
        .delete(`/auth/sessions/${sessionId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Cookie", cookies)
        .expect(200);

      expect(res.body).toEqual({ message: "Session revoked" });
    });

    it("POST /auth/sessions/revoke-all revokes other sessions", async () => {
      const res = await request(getServer())
        .post("/auth/sessions/revoke-all")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Cookie", cookies)
        .expect(201);

      expect(res.body).toEqual({ message: "All other sessions revoked" });
    });
  });

  describe("Integration: session lifecycle", () => {
    const lifecycleUser = {
      email: "lifecycle-test@example.com",
      password: "LifecyclePass1!",
      name: "Lifecycle Test",
    };

    it("logout blocks all protected routes", async () => {
      const registerRes = await request(getServer())
        .post("/auth/register")
        .send(lifecycleUser)
        .expect(201);

      const accessToken = registerRes.body.accessToken;
      const cookies = registerRes.headers["set-cookie"];

      const sessionsBefore = await request(getServer())
        .get("/auth/sessions")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Cookie", cookies)
        .expect(200);

      expect(sessionsBefore.body.length).toBe(1);

      await request(getServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Cookie", cookies)
        .expect(204);

      // What logout actually guarantees, and what it does not.
      //
      // `JwtStrategy.validate` returns the token's claims without consulting the
      // sessions table, so deleting the session does not invalidate an
      // access token that is still inside its 15-minute lifetime. This is the
      // standard trade-off for stateless JWTs, and it is the reason the access
      // token is short-lived and the refresh token is session-backed.
      //
      // The old assertion here expected 401 from every route after logout. That
      // is a stronger guarantee than this architecture provides, so it could
      // only ever fail. The test previously passed because it never ran in CI.
      //
      // If session-backed access tokens are ever wanted, the change is to look
      // the session up in `validate()` — that is a per-request database read,
      // which is precisely the cost stateless JWTs exist to avoid. Then these
      // two assertions become 401 and the access-token expiry becomes
      // defence in depth rather than the only bound.
      const refreshAfter = await request(getServer())
        .post("/auth/refresh")
        .set("Cookie", cookies)
        .expect(401); // the session is genuinely destroyed
      expect(refreshAfter.status).toBe(401);

      const meAfter = await request(getServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200); // …but the access token lives out its TTL
      expect(meAfter.body.email).toBe(lifecycleUser.email);

      // The window is bounded, and short. Asserted so that widening it — say,
      // to "one hour for convenience" — fails here rather than in production.
      const decoded = JSON.parse(
        Buffer.from(accessToken.split(".")[1], "base64url").toString(),
      );
      expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(15 * 60);

      // The session row is actually gone, which is what refresh checks.
      const [{ count }] = await dataSource.query(
        `SELECT count(*)::int AS count FROM sessions s
         JOIN users u ON u.id = s."userId" WHERE u.email = $1`,
        [lifecycleUser.email],
      );
      expect(count).toBe(0);
    });

    it("revoking a session prevents token refresh", async () => {
      const loginRes = await request(getServer()).post("/auth/login").send({
        email: lifecycleUser.email,
        password: lifecycleUser.password,
      });

      const accessToken = loginRes.body.accessToken;
      const cookies = loginRes.headers["set-cookie"];

      const sessionsRes = await request(getServer())
        .get("/auth/sessions")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Cookie", cookies)
        .expect(200);

      const sessionId = sessionsRes.body[0].id;

      await request(getServer())
        .delete(`/auth/sessions/${sessionId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Cookie", cookies)
        .expect(200);

      await request(getServer())
        .post("/auth/refresh")
        .set("Cookie", cookies)
        .expect(401);
    });

    it("refresh returns 401 without the refresh token cookie", async () => {
      await request(getServer()).post("/auth/refresh").expect(401);
    });
  });

  describe("Integration: email normalization", () => {
    const mixedEmail = "MixedCase@Example.Com";
    const lowerEmail = "mixedcase@example.com";
    const password = "NormalPass123!";

    afterAll(async () => {
      await dataSource.query(`DELETE FROM sessions`);
      await dataSource.query(`DELETE FROM users`);
    });

    it("register stores email in lowercase", async () => {
      const res = await request(getServer())
        .post("/auth/register")
        .send({ email: mixedEmail, password, name: "Mixed Case" })
        .expect(201);

      expect(res.body).toEqual({ accessToken: expect.any(String) });
    });

    it("login works with lowercased email", async () => {
      await request(getServer())
        .post("/auth/login")
        .send({ email: lowerEmail, password })
        .expect(201);
    });

    it("login works with same email in different case", async () => {
      await request(getServer())
        .post("/auth/login")
        .send({ email: "MIXEDCASE@EXAMPLE.COM", password })
        .expect(201);
    });

    it("rejects registration of same email with different case", async () => {
      await request(getServer())
        .post("/auth/register")
        .send({ email: "mixedcase@example.com", password, name: "Duplicate" })
        .expect(409);
    });
  });

  describe("POST /auth/forgot-password", () => {
    it("returns generic message for registered email", async () => {
      const res = await request(getServer())
        .post("/auth/forgot-password")
        .send({ email: testUser.email })
        .expect(200);

      expect(res.body.message).toContain("If that email is registered");
    });

    it("returns same message for unknown email", async () => {
      const res = await request(getServer())
        .post("/auth/forgot-password")
        .send({ email: "unknown@example.com" })
        .expect(200);

      expect(res.body.message).toContain("If that email is registered");
    });
  });

  describe("POST /auth/reset-password", () => {
    const resetUser = {
      email: "reset-e2e@example.com",
      password: "OriginalPass123!",
      name: "Reset E2E",
    };

    it("resets password with valid token and allows login with new password", async () => {
      await request(getServer())
        .post("/auth/register")
        .send(resetUser)
        .expect(201);

      const users = await dataSource.query(
        `SELECT id FROM users WHERE email = $1`,
        [resetUser.email],
      );
      const userId = users[0].id;

      const rawToken = "e2e-test-reset-token-123";
      // SHA-256, not argon2. Reset tokens were moved to a fast hash in the
      // security-hardening pass: the token is high-entropy random material that
      // is looked up by exact match, so a deliberately slow KDF bought nothing
      // and made every reset a multi-second operation. This fixture still used
      // argon2, so the service's SHA-256 lookup never matched its own stored
      // value and every reset attempt came back 400.
      const hashedToken = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 3_600_000);
      await dataSource.query(
        `INSERT INTO reset_tokens ("userId", "token", "expiresAt") VALUES ($1, $2, $3)`,
        [userId, hashedToken, expiresAt],
      );

      const newPassword = "NewStrongPass456!";
      const res = await request(getServer())
        .post("/auth/reset-password")
        .send({ token: rawToken, password: newPassword })
        .expect(201);

      expect(res.body).toEqual({
        message: "Password has been reset successfully.",
      });

      await request(getServer())
        .post("/auth/login")
        .send({ email: resetUser.email, password: newPassword })
        .expect(201);

      await request(getServer())
        .post("/auth/login")
        .send({ email: resetUser.email, password: resetUser.password })
        .expect(401);
    });

    it("rejects invalid token", async () => {
      const res = await request(getServer())
        .post("/auth/reset-password")
        .send({ token: "garbage-token", password: "AnotherNewPass1!" })
        .expect(400);

      expect(res.body.message).toContain("Invalid or expired reset token");
    });

    it("rejects short password", async () => {
      await request(getServer())
        .post("/auth/reset-password")
        .send({ token: "token", password: "short" })
        .expect(400);
    });
  });
});
