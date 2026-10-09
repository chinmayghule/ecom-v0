import { ConfigService } from "@nestjs/config";
import { useDataSource } from "../../test/setup.integration.js";
import { ResetToken } from "../auth/entities/reset-token.entity.js";
import { ResetTokenService } from "../auth/reset-token.service.js";
import { TokenHashService } from "../auth/token-hash.service.js";
import { User, UserRole } from "../entities/user.entity.js";

/**
 * The password reset token, against a real PostgreSQL.
 *
 * `resetPassword` used to be validate() → update password → markUsed(): three
 * statements with no transaction. Between the SELECT that checked
 * `usedAt IS NULL` and the UPDATE that stamped it, the token still read unused,
 * so fifty concurrent requests with one token all passed the check and all set a
 * password. The last writer won, the token ended up stamped, and nothing in the
 * logs looked wrong — while the victim clicked their own link a minute later,
 * were told it had expired, and concluded they were too slow.
 *
 * Password reset is exactly where this race is worth running: the token is
 * time-boxed to an hour and an attacker who has compromised a mailbox has a
 * strong incentive to land just before the real user.
 */
describe("ResetTokenService (integration)", () => {
  let service: ResetTokenService;
  let userId: string;

  beforeAll(() => {
    const dataSource = useDataSource();
    service = new ResetTokenService(
      dataSource.getRepository(ResetToken),
      new ConfigService({ RESET_TOKEN_EXPIRATION: "1h" }),
      new TokenHashService(),
    );
  });

  beforeEach(async () => {
    const dataSource = useDataSource();
    await dataSource.query('TRUNCATE "reset_tokens", "users" CASCADE');
    const user = await dataSource.getRepository(User).save({
      email: "victim@example.com",
      passwordHash: "x",
      name: "Victim",
      role: UserRole.CUSTOMER,
    });
    userId = user.id;
  });

  async function mint(): Promise<string> {
    const { rawToken } = await service.create(userId);
    return rawToken;
  }

  it("lets exactly one of fifty concurrent claims succeed", async () => {
    const token = await mint();

    const results = await Promise.all(
      Array.from({ length: 50 }, () => service.claim(token)),
    );

    const winners = results.filter(Boolean);
    // This is the whole point. The old implementation returned true 50 times.
    expect(winners).toHaveLength(1);
  });

  it("refuses every claim after the first", async () => {
    const token = await mint();

    expect(await service.claim(token)).toBe(true);
    expect(await service.claim(token)).toBe(false);
    expect(await service.claim(token)).toBe(false);
  });

  it("refuses an expired token", async () => {
    const token = await mint();
    await useDataSource().query(
      'UPDATE "reset_tokens" SET "expiresAt" = now() - interval \'1 hour\' WHERE "token" = $1',
      [new TokenHashService().hash(token)],
    );

    expect(await service.claim(token)).toBe(false);
  });

  it("invalidates outstanding tokens when a new one is requested", async () => {
    const first = await mint();
    const second = await mint();

    // Requesting a second reset must not leave the first link live. Otherwise N
    // requests to /auth/forgot-password produce N simultaneously valid tokens
    // for one mailbox and the requester cannot tell which email is current.
    expect(await service.claim(first)).toBe(false);
    expect(await service.claim(second)).toBe(true);
  });

  it("stores only the hash of the token", async () => {
    const token = await mint();
    const rows = await useDataSource().query(
      'SELECT "token" FROM "reset_tokens"',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].token).not.toBe(token);
    expect(rows[0].token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("deletes the token row when the account is deleted", async () => {
    await mint();
    await useDataSource().getRepository(User).delete({ id: userId });

    // Verifies the ON DELETE CASCADE constraint actually exists in the schema,
    // not merely as an annotation on the entity.
    const rows = await useDataSource().query(
      'SELECT count(*)::int AS n FROM "reset_tokens"',
    );
    expect(rows[0].n).toBe(0);
  });
});
