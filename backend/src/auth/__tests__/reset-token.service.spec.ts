import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResetToken } from "../entities/reset-token.entity.js";
import { ResetTokenService } from "../reset-token.service.js";
import { TokenHashService } from "../token-hash.service.js";

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
            findOne: vi.fn(),
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
        {
          provide: TokenHashService,
          useValue: {
            hash: vi.fn((token: string) => `hashed-${token}`),
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
      vi.mocked(repo.findOne).mockResolvedValue(token);

      const result = await service.validate("valid-raw-token");

      expect(result).toEqual(token);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: {
          token: "hashed-valid-raw-token",
          usedAt: expect.any(Object),
          expiresAt: expect.any(Object),
        },
      });
    });

    it("returns null when no tokens exist", async () => {
      vi.mocked(repo.findOne).mockResolvedValue(null);

      const result = await service.validate("any-token");

      expect(result).toBeNull();
    });

    it("returns null when token expired", async () => {
      vi.mocked(repo.findOne).mockResolvedValue(null);

      const result = await service.validate("expired-token");

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
