import crypto from "node:crypto";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as argon2 from "argon2";
import { IsNull, Not, Repository } from "typeorm";
import { ResetToken } from "./entities/reset-token.entity.js";

@Injectable()
export class ResetTokenService {
  constructor(
    @InjectRepository(ResetToken)
    private readonly repo: Repository<ResetToken>,
  ) {}

  async create(userId: string): Promise<{ rawToken: string }> {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await argon2.hash(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.repo.save(
      this.repo.create({
        userId,
        token: hashedToken,
        expiresAt,
      }),
    );

    return { rawToken };
  }

  async validate(token: string): Promise<ResetToken | null> {
    const tokens = await this.repo.find({
      where: { usedAt: IsNull() },
    });

    for (const resetToken of tokens) {
      if (resetToken.expiresAt < new Date()) continue;
      const valid = await argon2.verify(resetToken.token, token);
      if (valid) return resetToken;
    }

    return null;
  }

  async markUsed(id: string): Promise<void> {
    await this.repo.update(id, { usedAt: new Date() });
  }
}
