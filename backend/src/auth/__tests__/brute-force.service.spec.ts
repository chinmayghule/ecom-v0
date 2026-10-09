import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { LoginAttempt } from "../../entities/login-attempt.entity.js";
import { BruteForceService } from "../brute-force.service.js";

/**
 * Unit-level checks for BruteForceService.
 *
 * The counter itself is a single raw SQL statement, so most of its real
 * behaviour — atomicity under concurrency, ON CONFLICT resolution — cannot be
 * observed with a mocked repository. Those live in
 * `src/integration/brute-force.integration.spec.ts` against a real Postgres.
 * What is verified here is the shape of the call and the policy thresholds.
 */
describe("BruteForceService", () => {
  let service: BruteForceService;
  let repo: {
    findOne: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
    manager: { query: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    repo = {
      findOne: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 0 }),
      }),
      manager: { query: vi.fn().mockResolvedValue([]) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BruteForceService,
        { provide: getRepositoryToken(LoginAttempt), useValue: repo },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockImplementation((_k: string, d: string) => d),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(BruteForceService);
  });

  describe("identifier", () => {
    it("keys on a hash of the normalised email, not on userId", async () => {
      // The whole point of the redesign: an address with no user row must still
      // produce a lockout record, so the key cannot be a user id.
      await service.recordFailedAttempt("Alice@Example.COM", "user-1");
      const [sql, params] = repo.manager.query.mock.calls[0];

      expect(sql).toContain("ON CONFLICT");
      expect(params[1]).toBe("user-1");
      // sha256 of the lowercased, trimmed address — never the address itself.
      expect(params[0]).toMatch(/^[0-9a-f]{64}$/);
      expect(params[0]).not.toContain("alice");
    });

    it("treats differently-cased addresses as the same account", async () => {
      await service.recordFailedAttempt("Alice@Example.COM");
      await service.recordFailedAttempt("  alice@example.com  ");

      const [, a] = repo.manager.query.mock.calls[0];
      const [, b] = repo.manager.query.mock.calls[1];
      expect(a[0]).toBe(b[0]);
    });
  });

  describe("recordFailedAttempt", () => {
    it("issues one atomic statement rather than read-modify-write", async () => {
      await service.recordFailedAttempt("a@b.com");
      expect(repo.manager.query).toHaveBeenCalledTimes(1);
      // findOne/save is exactly the pattern that let 50 parallel attempts all
      // read 0 and write 1.
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it("returns the state reported by the statement", async () => {
      const lockUntil = new Date(Date.now() + 60_000);
      repo.manager.query.mockResolvedValue([
        { failedAttempts: 5, lockedUntil: lockUntil },
      ]);

      const result = await service.recordFailedAttempt("a@b.com");

      expect(result.failedAttempts).toBe(5);
      expect(result.locked).toBe(true);
    });

    it("is not locked below the threshold", async () => {
      repo.manager.query.mockResolvedValue([
        { failedAttempts: 2, lockedUntil: null },
      ]);

      const result = await service.recordFailedAttempt("a@b.com");

      expect(result.failedAttempts).toBe(2);
      expect(result.locked).toBe(false);
    });
  });

  describe("isLocked", () => {
    it("returns false when no record exists", async () => {
      await expect(service.isLocked("a@b.com")).resolves.toBe(false);
    });

    it("returns true while lockedUntil is in the future", async () => {
      repo.findOne.mockResolvedValue({
        lockedUntil: new Date(Date.now() + 60_000),
      });
      await expect(service.isLocked("a@b.com")).resolves.toBe(true);
    });

    it("returns false once lockedUntil has passed", async () => {
      repo.findOne.mockResolvedValue({
        lockedUntil: new Date(Date.now() - 60_000),
      });
      await expect(service.isLocked("a@b.com")).resolves.toBe(false);
    });
  });

  describe("resetAttempts", () => {
    it("deletes by identifier", async () => {
      await service.resetAttempts("a@b.com");
      expect(repo.delete).toHaveBeenCalledWith({
        identifier: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
    });
  });
});
