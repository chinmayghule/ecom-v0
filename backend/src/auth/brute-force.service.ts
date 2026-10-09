import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LoginAttempt } from "../entities/login-attempt.entity.js";
export interface AttemptResult {
  failedAttempts: number;
  lockedUntil: Date | null;
  locked: boolean;
}
/**
 * Account lockout on failed logins.
 *
 * Every mutation here is a single atomic SQL statement. The previous
 * findOne → mutate → save sequence was a read-modify-write, so fifty parallel
 * failed logins all read `failedAttempts = 0`, each wrote `1`, and the counter
 * never advanced — parallelism defeated the lockout entirely, which is the
 * easiest thing for an attacker with a script to do.
 */
@Injectable()
export class BruteForceService {
  constructor(
    @InjectRepository(LoginAttempt)
    private readonly repo: Repository<LoginAttempt>,
    private readonly configService: ConfigService,
  ) {}
  private get maxAttempts(): number {
    return parseInt(
      this.configService.get<string>("BRUTE_FORCE_MAX_ATTEMPTS", "5"),
      10,
    );
  }
  private get lockoutDurationMs(): number {
    return parseInt(
      this.configService.get<string>(
        "BRUTE_FORCE_LOCKOUT_DURATION_MS",
        String(15 * 60 * 1000),
      ),
      10,
    );
  }
  private get windowMs(): number {
    return parseInt(
      this.configService.get<string>(
        "BRUTE_FORCE_WINDOW_MS",
        String(15 * 60 * 1000),
      ),
      10,
    );
  }
  /**
   * Normalised, unguessable lockout key. Hashing means the table never stores a
   * plaintext address for someone who does not have an account, and lowercasing
   * means `Alice@x.com` and `alice@x.com` share one counter.
   */
  private identifierFor(email: string): string {
    return createHash("sha256")
      .update(email.trim().toLowerCase())
      .digest("hex");
  }
  async isLocked(email: string): Promise<boolean> {
    const record = await this.repo.findOne({
      where: { identifier: this.identifierFor(email) },
    });
    if (!record?.lockedUntil) return false;
    return record.lockedUntil > new Date();
  }
  /**
   * Records one failed attempt and returns the resulting state.
   *
   * Works for addresses with no user row: `userId` is nullable and the row is
   * keyed on the email hash, so an unknown address is throttled exactly like a
   * known one. A previously expired lock is cleared here so the next attempt
   * starts from a clean counter.
   */
  async recordFailedAttempt(
    email: string,
    userId?: string,
  ): Promise<AttemptResult> {
    const identifier = this.identifierFor(email);
    const windowStart = new Date(Date.now() - this.windowMs);
    const lockUntil = new Date(Date.now() + this.lockoutDurationMs);
    // One atomic statement.
    //
    // The counter expression is repeated in the lockedUntil CASE because
    // Postgres evaluates every SET expression against the OLD row — there is no
    // "new value" reference. That is also why the lock cannot be set from a
    // separate statement in a data-modifying CTE: the outer UPDATE runs against
    // the statement's starting snapshot and cannot see the CTE's own INSERT, so
    // it matched zero rows and lockedUntil was never written. Verified against
    // a real database — `UPDATE 0`, while the counter silently incremented.
    const result = await this.repo.manager.query(
      `
      INSERT INTO "login_attempts"
        ("identifier", "userId", "failedAttempts", "lockedUntil", "lastAttemptAt", "createdAt")
      VALUES ($1, $2, 1, NULL, now(), now())
      ON CONFLICT ("identifier") DO UPDATE SET
        "failedAttempts" = CASE
          WHEN login_attempts."lockedUntil" IS NOT NULL
            AND login_attempts."lockedUntil" <= now() THEN 1
          WHEN login_attempts."lastAttemptAt" < $3 THEN 1
          ELSE login_attempts."failedAttempts" + 1
        END,
        "lockedUntil" = CASE
          WHEN (
            CASE
              WHEN login_attempts."lockedUntil" IS NOT NULL
                AND login_attempts."lockedUntil" <= now() THEN 1
              WHEN login_attempts."lastAttemptAt" < $3 THEN 1
              ELSE login_attempts."failedAttempts" + 1
            END
          ) >= $4 THEN $5
          WHEN login_attempts."lockedUntil" IS NOT NULL
            AND login_attempts."lockedUntil" <= now() THEN NULL
          ELSE login_attempts."lockedUntil"
        END,
        "lastAttemptAt" = now(),
        "userId" = COALESCE(EXCLUDED."userId", login_attempts."userId")
      RETURNING "failedAttempts", "lockedUntil"
      `,
      [identifier, userId ?? null, windowStart, this.maxAttempts, lockUntil],
    );
    const row = (result as AttemptResult[])[0] ?? {
      failedAttempts: 0,
      lockedUntil: null,
    };
    return {
      failedAttempts: Number(row.failedAttempts),
      lockedUntil: row.lockedUntil ? new Date(row.lockedUntil) : null,
      locked: row.lockedUntil ? new Date(row.lockedUntil) > new Date() : false,
    };
  }
  async resetAttempts(email: string): Promise<void> {
    await this.repo.delete({ identifier: this.identifierFor(email) });
  }
  /**
   * Clears attempts when an account is created, so a user who mistyped their
   * password during registration is not locked out before first login.
   */
  async resetForUser(userId: string): Promise<void> {
    if (!userId) return;
    await this.repo
      .createQueryBuilder()
      .delete()
      .from(LoginAttempt)
      .where('"userId" = :userId', { userId })
      .execute();
  }
  /** Housekeeping for a scheduled job — rows past the window with no lock. */
  async purgeStale(): Promise<number> {
    const cutoff = new Date(Date.now() - this.windowMs);
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .from(LoginAttempt)
      .where('"lastAttemptAt" < :cutoff', { cutoff })
      .andWhere('"lockedUntil" IS NULL OR "lockedUntil" <= now()')
      .execute();
    return result.affected ?? 0;
  }
}
