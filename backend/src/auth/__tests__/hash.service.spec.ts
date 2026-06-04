import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HashService } from "../hash.service.js";

vi.mock(import("argon2"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hash: vi.fn((p: string) => Promise.resolve(`hashed_${p}`)),
    verify: vi.fn((h: string, p: string) =>
      Promise.resolve(h === `hashed_${p}`),
    ),
  };
});

describe("HashService", () => {
  let service: HashService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [HashService],
    }).compile();
    service = module.get(HashService);
  });

  describe("hashPassword", () => {
    it("hashes a password", async () => {
      const result = await service.hashPassword("myPassword123");
      expect(result).toBe("hashed_myPassword123");
    });

    it("throws on empty password", async () => {
      await expect(service.hashPassword("")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("verifyPassword", () => {
    it("returns true for correct password", async () => {
      const result = await service.verifyPassword(
        "hashed_myPassword123",
        "myPassword123",
      );
      expect(result).toBe(true);
    });

    it("returns false for incorrect password", async () => {
      const result = await service.verifyPassword(
        "hashed_myPassword123",
        "wrongPassword",
      );
      expect(result).toBe(false);
    });

    it("throws on empty hash", async () => {
      await expect(
        service.verifyPassword("", "password"),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws on empty plain", async () => {
      await expect(
        service.verifyPassword("hashed_abc", ""),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
