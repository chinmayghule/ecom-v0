import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Session } from "../entities/session.entity.js";

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
  ) {}

  async createSession(
    userId: string,
    refreshToken: string,
    expiresAt: Date,
    userAgent?: string,
    ipAddress?: string,
    deviceInfo?: Record<string, any>,
  ): Promise<Session> {
    const session = this.sessionRepo.create({
      user: { id: userId } as any,
      refreshToken,
      expiresAt,
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
      deviceInfo: deviceInfo ?? null,
      lastActiveAt: new Date(),
    });
    return this.sessionRepo.save(session);
  }

  async findByUserId(userId: string): Promise<Session[]> {
    return this.sessionRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: "DESC" },
    });
  }

  async findById(id: string): Promise<Session | null> {
    return this.sessionRepo.findOne({ where: { id } });
  }

  async revokeSession(id: string, userId: string): Promise<void> {
    await this.sessionRepo.delete({ id, user: { id: userId } });
  }

  async revokeAllSessions(
    userId: string,
    excludeSessionId?: string,
  ): Promise<void> {
    if (excludeSessionId) {
      await this.revokeAllExcept(userId, excludeSessionId);
    } else {
      await this.sessionRepo.delete({ user: { id: userId } });
    }
  }

  private async revokeAllExcept(
    userId: string,
    excludeSessionId: string,
  ): Promise<void> {
    const sessions = await this.findByUserId(userId);
    const toDelete = sessions
      .filter((s) => s.id !== excludeSessionId)
      .map((s) => s.id);
    if (toDelete.length > 0) {
      await this.sessionRepo.delete(toDelete);
    }
  }

  async validateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<Session | null> {
    const session = await this.sessionRepo.findOne({
      where: { user: { id: userId }, refreshToken },
    });
    if (!session) return null;
    if (new Date() > session.expiresAt) {
      await this.sessionRepo.remove(session);
      return null;
    }
    session.lastActiveAt = new Date();
    return this.sessionRepo.save(session);
  }

  async updateLastActive(sessionId: string): Promise<void> {
    await this.sessionRepo.update(sessionId, {
      lastActiveAt: new Date(),
    });
  }

  parseDeviceInfo(userAgent: string): Record<string, any> {
    const osPatterns: Record<string, RegExp> = {
      iOS: /iPhone|iPad|iPod/i,
      Android: /Android/i,
      Windows: /Windows NT/i,
      macOS: /Mac OS X/i,
      Linux: /Linux/i,
    };
    const browserPatterns: Record<string, RegExp> = {
      Chrome: /Chrome/i,
      Firefox: /Firefox/i,
      Safari: /Safari/i,
      Edge: /Edg/i,
      Opera: /Opera|OPR/i,
    };

    let os = "Unknown";
    for (const [name, pattern] of Object.entries(osPatterns)) {
      if (pattern.test(userAgent)) {
        os = name;
        break;
      }
    }

    let browser = "Unknown";
    for (const [name, pattern] of Object.entries(browserPatterns)) {
      if (pattern.test(userAgent)) {
        browser = name;
        break;
      }
    }

    const deviceType = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent)
      ? "mobile"
      : "desktop";

    return { os, browser, deviceType };
  }
}
