import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Index `sessions.refreshToken`.
 *
 * Every authenticated request resolves its refresh token by exact match on the
 * hashed value — `SessionService` does `findOne({ where: { refreshToken } })` and
 * a raw `"refreshToken" = :hash` for replay detection. Without an index that is
 * a sequential scan of `sessions`, and the table is the one that grows fastest:
 * it gains a row per login and loses them only on logout or expiry.
 *
 * At the scale this project targets the difference is a few milliseconds, so
 * this is not a performance emergency. It is here because the query is on the
 * hot path of every single authenticated request, and an unindexed lookup on the
 * hot path is exactly the kind of thing that is invisible in development and
 * ruinous at volume — the Phase 2 k6 exercise would otherwise discover it.
 *
 * A new migration on top of the baseline rather than an edit to it:
 * `1791544704010-InitialSchema` has already run on shared databases, and
 * editing a shipped migration is how schemas end up half-applied.
 *
 * Not unique. A token hash is unique by construction — it is a SHA-256 of a
 * high-entropy random string, and rotation consumes the old row — so a unique
 * index would be defensible. It is left non-unique to match how the table is
 * actually used and to keep this migration to a single additive statement.
 */
export class AddSessionRefreshTokenIndex1791601120000
  implements MigrationInterface
{
  name = "AddSessionRefreshTokenIndex1791601120000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_sessions_refresh_token" ON "sessions" ("refreshToken")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_sessions_refresh_token"`);
  }
}
