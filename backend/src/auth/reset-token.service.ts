import crypto from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import type { DeepPartial } from "typeorm";
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
    const expiresInMs = parseInt(
      this.configService.get("RESET_TOKEN_EXPIRATION_MS", "3600000"),
      10,
    );
    const expiresAt = new Date(Date.now() + expiresInMs);

    await this.repo.save(
      this.repo.create({
        user: { id: userId } as DeepPartial<User>,
        token: hashedToken,
        expiresAt,
      }),
    );

    return { rawToken };
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

  async markUsed(id: string): Promise<void> {
    await this.repo.update(id, { usedAt: new Date() });
  }
}
