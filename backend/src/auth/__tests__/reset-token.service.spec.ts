import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as argon2 from "argon2";
import type { Repository } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResetToken } from "../entities/reset-token.entity.js";
import { ResetTokenService } from "../reset-token.service.js";

vi.mock("argon2", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-argon2-token"),
    verify: vi.fn(),
  },
  hash: vi.fn().mockResolvedValue("hashed-argon2-token"),
  verify: vi.fn(),
}));

const mockResetToken = (overrides: Partial<ResetToken> = {}): ResetToken =>
  ({
    id: "rt-1",
    userId: "user-1",
    token: "hashed-token-value",
    expiresAt: new Date(Date.now() + 3600000),
    usedAt: null,
    createdAt: new Date(),
    ...overrides,
  }) as ResetToken;

describe("ResetTokenService", () => {
  let service: ResetTokenService;
  let repo: Repository<ResetToken>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        ResetTokenService,
        {
          provide: getRepositoryToken(ResetToken),
          useValue: {
            create: vi.fn(),
            save: vi.fn(),
            find: vi.fn(),
            update: vi.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi
              .fn()
              .mockImplementation(
                (_key: string, defaultValue?: string) => defaultValue ?? null,
              ),
          },
        },
      ],
    }).compile();

    service = module.get(ResetTokenService);
    repo = module.get(getRepositoryToken(ResetToken));
  });

  describe("create", () => {
    it("generates a token, hashes it, and saves with expiry", async () => {
      const token = mockResetToken();
      vi.mocked(repo.create).mockReturnValue(token);
      vi.mocked(repo.save).mockResolvedValue(token);

      const result = await service.create("user-1");

      expect(result).toHaveProperty("rawToken");
      expect(typeof result.rawToken).toBe("string");
      expect(result.rawToken.length).toBe(64);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          expiresAt: expect.any(Date),
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(token);
    });

    it("uses default expiry when env var is not set", async () => {
      const token = mockResetToken();
      vi.mocked(repo.create).mockReturnValue(token);
      vi.mocked(repo.save).mockResolvedValue(token);

      await service.create("user-1");

      const createCallArg = vi.mocked(repo.create).mock.calls[0][0] as {
        expiresAt: Date;
      };
      const expectedMaxExpiry = Date.now() + 3600000 + 5000;
      expect(createCallArg.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(createCallArg.expiresAt.getTime()).toBeLessThan(expectedMaxExpiry);
    });
  });

  describe("validate", () => {
    it("returns token when valid and not expired", async () => {
      const token = mockResetToken();
      vi.mocked(repo.find).mockResolvedValue([token]);
      vi.mocked(argon2.verify).mockResolvedValue(true);

      const result = await service.validate("valid-raw-token");

      expect(result).toEqual(token);
      expect(repo.find).toHaveBeenCalledWith({
        where: { usedAt: expect.any(Object) },
      });
    });

    it("returns null when no tokens exist", async () => {
      vi.mocked(repo.find).mockResolvedValue([]);

      const result = await service.validate("any-token");

      expect(result).toBeNull();
    });

    it("skips expired tokens and returns null if none valid", async () => {
      const expiredToken = mockResetToken({
        expiresAt: new Date(Date.now() - 3600000),
      });
      vi.mocked(repo.find).mockResolvedValue([expiredToken]);

      const result = await service.validate("expired-token");

      expect(argon2.verify).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("skips tokens with mismatched hash and tries next", async () => {
      const validToken = mockResetToken();
      vi.mocked(repo.find).mockResolvedValue([validToken]);
      vi.mocked(argon2.verify).mockResolvedValue(false);

      const result = await service.validate("wrong-token");

      expect(argon2.verify).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("markUsed", () => {
    it("sets usedAt timestamp on the token", async () => {
      vi.mocked(repo.update).mockResolvedValue({ affected: 1, raw: {} });

      await service.markUsed("rt-1");

      expect(repo.update).toHaveBeenCalledWith("rt-1", {
        usedAt: expect.any(Date),
      });
    });
  });
});
