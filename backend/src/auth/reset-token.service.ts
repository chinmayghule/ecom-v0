import crypto from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import type { StringValue } from "ms";
import ms from "ms";
import type { DeepPartial, EntityManager } from "typeorm";
import { IsNull, MoreThan, Repository } from "typeorm";
import { User } from "../entities/user.entity.js";
import { ResetToken } from "./entities/reset-token.entity.js";
import { TokenHashService } from "./token-hash.service.js";

@Injectable()
export class ResetTokenService {
  constructor(
    @InjectRepository(ResetToken)
    private readonly repo: Repository<ResetToken>,
    private readonly configService: ConfigService,
    private readonly tokenHashService: TokenHashService,
  ) {}

  async create(userId: string): Promise<{ rawToken: string }> {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = this.tokenHashService.hash(rawToken);
    const expiresInMs = ms(
      this.configService.get<string>(
        "RESET_TOKEN_EXPIRATION",
        "1h",
      ) as StringValue,
    );
    const expiresAt = new Date(Date.now() + expiresInMs);

    // Invalidate anything outstanding first. Otherwise N requests to
    // /auth/forgot-password leave N simultaneously valid tokens for one
    // mailbox, and the requester has no way to know which email is the live one.
    await this.revokeOutstanding(userId);

    await this.repo.save(
      this.repo.create({
        user: { id: userId } as DeepPartial<User>,
        token: hashedToken,
        expiresAt,
      }),
    );

    return { rawToken };
  }

  async revokeOutstanding(userId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(ResetToken)
      .set({ usedAt: new Date() })
      .where('"userId" = :userId', { userId })
      .andWhere('"usedAt" IS NULL')
      .execute();
  }

  async validate(token: string): Promise<ResetToken | null> {
    const hashedToken = this.tokenHashService.hash(token);
    return this.repo.findOne({
      where: {
        token: hashedToken,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: { user: true },
    });
  }

  /**
   * Atomically claims an unused, unexpired token.
   *
   * Returns true for exactly one caller no matter how many race it. The old
   * shape was validate() → change password → markUsed(): three statements with
   * no transaction, so fifty concurrent requests with the same token all passed
   * the `usedAt IS NULL` check before any of them marked it used, and all fifty
   * set a password. The token ended up stamped, so nothing looked wrong, and
   * the last writer won.
   *
   * A single conditional UPDATE closes that: Postgres guarantees one
   * transaction can match the row, everyone else gets `affected === 0`.
   */
  async claim(token: string, manager?: EntityManager): Promise<boolean> {
    const hashedToken = this.tokenHashService.hash(token);
    const executor = manager
      ? manager.createQueryBuilder()
      : this.repo.createQueryBuilder();

    const result = await executor
      .update(ResetToken)
      .set({ usedAt: new Date() })
      .where('"token" = :hashedToken', { hashedToken })
      .andWhere('"usedAt" IS NULL')
      .andWhere('"expiresAt" > :now', { now: new Date() })
      .execute();

    return (result.affected ?? 0) === 1;
  }

  async findByToken(token: string): Promise<ResetToken | null> {
    const hashedToken = this.tokenHashService.hash(token);
    return this.repo.findOne({
      where: { token: hashedToken },
      relations: { user: true },
    });
  }

  async markUsed(id: string): Promise<void> {
    await this.repo.update(id, { usedAt: new Date() });
  }
}
