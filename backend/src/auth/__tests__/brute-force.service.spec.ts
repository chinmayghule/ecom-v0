import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginAttempt } from "../../entities/login-attempt.entity.js";
import { BruteForceService } from "../brute-force.service.js";

describe("BruteForceService", () => {
  let service: BruteForceService;
  let repo: Repository<LoginAttempt>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BruteForceService,
        {
          provide: getRepositoryToken(LoginAttempt),
          useValue: {
            findOne: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(BruteForceService);
    repo = module.get(getRepositoryToken(LoginAttempt));
  });

  describe("isLocked", () => {
    it("returns false when no record exists", async () => {
      vi.mocked(repo.findOne).mockResolvedValue(null);

      const result = await service.isLocked("user-1");

      expect(result).toBe(false);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });

    it("returns true when lockedUntil is in the future", async () => {
      const future = new Date(Date.now() + 60_000);
      vi.mocked(repo.findOne).mockResolvedValue({
        id: "1",
        userId: "user-1",
        failedAttempts: 5,
        lockedUntil: future,
        createdAt: new Date(),
      } as LoginAttempt);

      const result = await service.isLocked("user-1");

      expect(result).toBe(true);
    });

    it("returns false and cleans up when lockout has expired", async () => {
      const past = new Date(Date.now() - 60_000);
      vi.mocked(repo.findOne).mockResolvedValue({
        id: "1",
        userId: "user-1",
        failedAttempts: 5,
        lockedUntil: past,
        createdAt: new Date(),
      } as LoginAttempt);
      vi.mocked(repo.delete).mockResolvedValue({ affected: 1, raw: {} });

      const result = await service.isLocked("user-1");

      expect(result).toBe(false);
      expect(repo.delete).toHaveBeenCalledWith({ userId: "user-1" });
    });

    it("returns false when lockedUntil is null", async () => {
      vi.mocked(repo.findOne).mockResolvedValue({
        id: "1",
        userId: "user-1",
        failedAttempts: 2,
        lockedUntil: null,
        createdAt: new Date(),
      } as LoginAttempt);

      const result = await service.isLocked("user-1");

      expect(result).toBe(false);
    });
  });

  describe("recordFailedAttempt", () => {
    it("creates new record with 1 failed attempt when none exists", async () => {
      vi.mocked(repo.findOne).mockResolvedValue(null);
      vi.mocked(repo.create).mockReturnValue({
        userId: "user-1",
        failedAttempts: 1,
        lockedUntil: null,
      } as LoginAttempt);
      vi.mocked(repo.save).mockResolvedValue({} as LoginAttempt);

      await service.recordFailedAttempt("user-1");

      expect(repo.create).toHaveBeenCalledWith({
        userId: "user-1",
        failedAttempts: 1,
        lockedUntil: null,
      });
      expect(repo.save).toHaveBeenCalled();
    });

    it("increments failed attempts for existing record", async () => {
      const record = {
        id: "1",
        userId: "user-1",
        failedAttempts: 2,
        lockedUntil: null,
        createdAt: new Date(),
      } as LoginAttempt;
      vi.mocked(repo.findOne).mockResolvedValue(record);
      vi.mocked(repo.save).mockResolvedValue(record);

      await service.recordFailedAttempt("user-1");

      expect(record.failedAttempts).toBe(3);
      expect(repo.save).toHaveBeenCalledWith(record);
    });

    it("locks account after 5 failed attempts", async () => {
      const record = {
        id: "1",
        userId: "user-1",
        failedAttempts: 4,
        lockedUntil: null,
        createdAt: new Date(),
      } as LoginAttempt;
      vi.mocked(repo.findOne).mockResolvedValue(record);
      vi.mocked(repo.save).mockResolvedValue(record);

      await service.recordFailedAttempt("user-1");

      expect(record.failedAttempts).toBe(5);
      expect(record.lockedUntil).toBeInstanceOf(Date);
      expect(repo.save).toHaveBeenCalledWith(record);
    });

    it("resets counter when window has expired", async () => {
      const oldDate = new Date(Date.now() - 20 * 60 * 1000); // 20 min ago
      const record = {
        id: "1",
        userId: "user-1",
        failedAttempts: 3,
        lockedUntil: null,
        createdAt: oldDate,
      } as LoginAttempt;
      vi.mocked(repo.findOne).mockResolvedValue(record);
      vi.mocked(repo.save).mockResolvedValue(record);

      await service.recordFailedAttempt("user-1");

      expect(record.failedAttempts).toBe(1);
      expect(record.lockedUntil).toBeNull();
      expect(repo.save).toHaveBeenCalledWith(record);
    });
  });

  describe("resetAttempts", () => {
    it("deletes all records for the user", async () => {
      vi.mocked(repo.delete).mockResolvedValue({ affected: 1, raw: {} });

      await service.resetAttempts("user-1");

      expect(repo.delete).toHaveBeenCalledWith({ userId: "user-1" });
    });
  });
});
