import { useDataSource } from "../../test/setup.integration.js";
import { SessionService } from "../auth/session.service.js";
import { TokenHashService } from "../auth/token-hash.service.js";
import { Session } from "../entities/session.entity.js";
import { User, UserRole } from "../entities/user.entity.js";

/**
 * Refresh-token rotation, against a real PostgreSQL.
 *
 * Rotation is the control that limits how long a stolen refresh token is useful.
 * It only works if spending a token is atomic: the previous shape was a SELECT
 * followed by a DELETE, so two concurrent requests carrying the same token both
 * saw an unspent session and both received fresh tokens.
 *
 * Reuse detection lives here too, because it is the same primitive viewed from
 * the other side — a token that has already been spent.
 */
describe("SessionService (integration)", () => {
  let service: SessionService;
  let userId: string;

  const tokenHash = (t: string) => new TokenHashService().hash(t);

  beforeAll(() => {
    service = new SessionService(
      useDataSource().getRepository(Session),
      new TokenHashService(),
    );
  });

  beforeEach(async () => {
    const dataSource = useDataSource();
    await dataSource.query('TRUNCATE "sessions", "users" CASCADE');
    const user = await dataSource.getRepository(User).save({
      email: "rot@example.com",
      passwordHash: "x",
      name: "Rot",
      role: UserRole.CUSTOMER,
    });
    userId = user.id;
  });

  async function seed(token: string) {
    return service.createSession(
      userId,
      token,
      new Date(Date.now() + 60_000),
      "vitest",
      "127.0.0.1",
    );
  }

  it("spends an unspent token exactly once", async () => {
    await seed("token-a");

    const spent = await service.consumeSessionByTokenHash(
      tokenHash("token-a"),
      userId,
    );
    expect(spent).not.toBeNull();

    const again = await service.consumeSessionByTokenHash(
      tokenHash("token-a"),
      userId,
    );
    expect(again).toBeNull();
  });

  it("lets exactly one of fifty concurrent refreshes win", async () => {
    // The scenario the atomic DELETE exists for. Under a check-then-delete
    // implementation, all fifty observe an unspent session and all fifty are
    // issued a fresh token pair — which is how one stolen token becomes fifty.
    await seed("token-race");

    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        service.consumeSessionByTokenHash(tokenHash("token-race"), userId),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("cannot spend another account's session", async () => {
    await seed("token-b");
    const other = await useDataSource().getRepository(User).save({
      email: "other@example.com",
      passwordHash: "x",
      name: "Other",
      role: UserRole.CUSTOMER,
    });

    // Token is valid and unspent, but it belongs to someone else.
    const result = await service.consumeSessionByTokenHash(
      tokenHash("token-b"),
      other.id,
    );
    expect(result).toBeNull();

    // And the rightful owner's session survived the attempt.
    expect(
      await service.findByRefreshTokenHash(tokenHash("token-b")),
    ).not.toBeNull();
  });

  it("revokeAllSessions clears every session for the user", async () => {
    await seed("t1");
    await seed("t2");
    await seed("t3");

    await service.revokeAllSessions(userId);

    expect(await service.findByUserId(userId)).toHaveLength(0);
  });

  it("revokeAllSessions can keep the current session", async () => {
    const keep = await seed("keep");
    await seed("drop-1");
    await seed("drop-2");

    await service.revokeAllSessions(userId, keep.id);

    const remaining = await service.findByUserId(userId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(keep.id);
  });

  it("deletes sessions when the account is deleted", async () => {
    await seed("cascade-me");
    await useDataSource().getRepository(User).delete({ id: userId });

    const rows = await useDataSource().query(
      'SELECT count(*)::int AS n FROM "sessions"',
    );
    expect(rows[0].n).toBe(0);
  });

  it("stores only the token hash, never the token itself", async () => {
    await seed("super-secret-token");

    const stored = await useDataSource().query(
      'SELECT "refreshToken" FROM "sessions"',
    );
    expect(stored[0].refreshToken).toBe(tokenHash("super-secret-token"));
    expect(stored[0].refreshToken).not.toContain("super-secret-token");
  });
});
