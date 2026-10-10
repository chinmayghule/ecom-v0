import { ConfigService } from "@nestjs/config";
import { useDataSource } from "../../test/setup.integration.js";
import { BruteForceService } from "../auth/brute-force.service.js";
import { LoginAttempt } from "../entities/login-attempt.entity.js";
import { User, UserRole } from "../entities/user.entity.js";

/**
 * The brute-force counter, against a real PostgreSQL.
 *
 * The original implementation was `findOne` → mutate → `save`. Fifty parallel
 * failed logins all read `failedAttempts = 0`, each wrote `1`, and the counter
 * never advanced past 1 — so the lockout, the one control protecting a known
 * account from password guessing, was defeated by the single easiest thing an
 * attacker with a script can do. A unit test with a mocked repository asserted
 * the counter incremented and passed, because it never ran the SQL.
 *
 * `Promise.all` below issues genuinely concurrent statements on separate
 * connections, which is what makes this a real test of atomicity rather than a
 * test of sequential calls.
 */
describe("BruteForceService (integration)", () => {
  let service: BruteForceService;
  let repo: ReturnType<typeof useDataSource>["getRepository"] extends (
    ...args: never[]
  ) => infer R
    ? R
    : never;
  let userId: string | undefined;

  beforeAll(() => {
    const dataSource = useDataSource();
    repo = dataSource.getRepository(LoginAttempt);
    service = new BruteForceService(
      dataSource.getRepository(LoginAttempt),
      new ConfigService({
        BRUTE_FORCE_MAX_ATTEMPTS: "5",
        BRUTE_FORCE_LOCKOUT_DURATION_MS: "900000",
        BRUTE_FORCE_WINDOW_MS: "900000",
      }),
    );
  });

  beforeEach(async () => {
    await useDataSource().query('TRUNCATE "login_attempts", "users" CASCADE');
    const user = await useDataSource().getRepository(User).save({
      email: "victim@example.com",
      passwordHash: "x",
      name: "Victim",
      role: UserRole.CUSTOMER,
    });
    userId = user.id;
  });

  it("counts every concurrent attempt, so the lockout cannot be outrun", async () => {
    await Promise.all(
      Array.from({ length: 50 }, () =>
        service.recordFailedAttempt("victim@example.com", userId),
      ),
    );

    const row = await repo.findOne({
      where: { user: { id: userId as string } },
    });

    // Under the old read-modify-write this was 1. With an atomic upsert it is 50.
    expect(Number(row?.failedAttempts)).toBe(50);
  });

  it("locks the account once the threshold is crossed", async () => {
    for (let i = 0; i < 4; i++) {
      await service.recordFailedAttempt("victim@example.com", userId);
    }
    expect(await service.isLocked("victim@example.com")).toBe(false);

    await service.recordFailedAttempt("victim@example.com", userId);

    expect(await service.isLocked("victim@example.com")).toBe(true);
  });

  it("creates exactly one row per identifier", async () => {
    await Promise.all(
      Array.from({ length: 20 }, () =>
        service.recordFailedAttempt("victim@example.com", userId),
      ),
    );

    const rows = await repo.find({ where: { user: { id: userId as string } } });
    expect(rows).toHaveLength(1);
  });

  it("throttles an address that has no account at all", async () => {
    // This is the case the userId-keyed table could not represent: no user row
    // means no possible primary key, so no lockout record and no limit.
    for (let i = 0; i < 5; i++) {
      await service.recordFailedAttempt("never-registered@example.com");
    }

    expect(await service.isLocked("never-registered@example.com")).toBe(true);

    const rows = await useDataSource()
      .getRepository(LoginAttempt)
      .createQueryBuilder("la")
      .where('la."userId" IS NULL')
      .getMany();
    expect(rows).toHaveLength(1);
  });

  it("treats casing and whitespace as the same account", async () => {
    await service.recordFailedAttempt("Victim@Example.com", userId);
    await service.recordFailedAttempt("  victim@EXAMPLE.COM  ", userId);

    const rows = await repo.find({ where: { user: { id: userId as string } } });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]?.failedAttempts)).toBe(2);
  });

  it("never stores the plaintext address", async () => {
    await service.recordFailedAttempt("victim@example.com", userId);

    const { identifier } = await repo.findOneOrFail({
      where: { user: { id: userId as string } },
    });
    expect(identifier).toMatch(/^[0-9a-f]{64}$/);
    expect(identifier).not.toContain("victim");
  });

  it("resets the counter after a successful login", async () => {
    for (let i = 0; i < 3; i++) {
      await service.recordFailedAttempt("victim@example.com", userId);
    }
    await service.resetAttempts("victim@example.com");

    expect(
      await repo.findOne({ where: { user: { id: userId as string } } }),
    ).toBeNull();
    expect(await service.isLocked("victim@example.com")).toBe(false);
  });

  it("removes the record when the account is deleted", async () => {
    await service.recordFailedAttempt("victim@example.com", userId);
    await useDataSource()
      .getRepository(User)
      .delete({ id: userId as string });

    // ON DELETE CASCADE from login_attempts.userId — verified against a real
    // constraint rather than an entity annotation that may not be in the schema.
    expect(await repo.find()).toHaveLength(0);
  });
});
