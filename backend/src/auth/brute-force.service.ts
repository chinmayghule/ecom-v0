import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LoginAttempt } from "../entities/login-attempt.entity.js";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class BruteForceService {
  constructor(
    @InjectRepository(LoginAttempt)
    private readonly repo: Repository<LoginAttempt>,
  ) {}

  async isLocked(userId: string): Promise<boolean> {
    const record = await this.repo.findOne({ where: { userId } });
    if (!record) return false;
    if (record.lockedUntil && record.lockedUntil > new Date()) return true;
    if (record.lockedUntil && record.lockedUntil <= new Date()) {
      await this.repo.delete({ userId });
    }
    return false;
  }

  async recordFailedAttempt(userId: string): Promise<void> {
    const windowStart = new Date(Date.now() - WINDOW_MS);
    let record = await this.repo.findOne({ where: { userId } });
    if (!record) {
      record = this.repo.create({
        userId,
        failedAttempts: 1,
        lockedUntil: null,
      });
    } else {
      if (record.createdAt < windowStart) {
        record.failedAttempts = 1;
        record.lockedUntil = null;
        record.createdAt = new Date();
      } else {
        record.failedAttempts += 1;
      }
    }
    if (record.failedAttempts >= MAX_ATTEMPTS) {
      record.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }
    await this.repo.save(record);
  }

  async resetAttempts(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
