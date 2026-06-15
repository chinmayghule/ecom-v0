import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Session } from "../../entities/session.entity.js";
import { SessionService } from "../session.service.js";
import { TokenHashService } from "../token-hash.service.js";

const mockSession = (overrides: Partial<Session> = {}): Session =>
  ({
    id: "session-1",
    refreshToken: "hashed-refresh-token-1",
    user: { id: "user-1" } as Partial<
      import("../../../entities/user.entity.js").User
    >,
    expiresAt: new Date(Date.now() + 86400000),
    userAgent: "Mozilla/5.0",
    ipAddress: "127.0.0.1",
    deviceInfo: { os: "Linux", browser: "Chrome", deviceType: "desktop" },
    lastActiveAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Session;

describe("SessionService", () => {
  let service: SessionService;
  let repo: Repository<Session>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: TokenHashService,
          useValue: {
            hash: vi.fn((token: string) => `hashed-${token}`),
            compare: vi.fn((token: string, hash: string) => {
              return `hashed-${token}` === hash;
            }),
          },
        },
        {
          provide: getRepositoryToken(Session),
          useValue: {
            create: vi.fn(),
            save: vi.fn(),
            find: vi.fn(),
            findOne: vi.fn(),
            findOneBy: vi.fn(),
            delete: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
          },
        },
      ],
    }).compile();
    service = module.get(SessionService);
    repo = module.get(getRepositoryToken(Session));
  });

  describe("createSession", () => {
    it("creates and saves a session with hashed token", async () => {
      const session = mockSession();
      vi.mocked(repo.create).mockReturnValue(session);
      vi.mocked(repo.save).mockResolvedValue(session);

      const result = await service.createSession(
        "user-1",
        "refresh-token-1",
        session.expiresAt,
        "Mozilla/5.0",
        "127.0.0.1",
        { os: "Linux", browser: "Chrome", deviceType: "desktop" },
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: "hashed-refresh-token-1",
          userAgent: "Mozilla/5.0",
          ipAddress: "127.0.0.1",
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(session);
      expect(result).toEqual(session);
    });

    it("handles missing optional fields", async () => {
      const session = mockSession({
        userAgent: null,
        ipAddress: null,
        deviceInfo: null,
        refreshToken: "hashed-token",
      });
      vi.mocked(repo.create).mockReturnValue(session);
      vi.mocked(repo.save).mockResolvedValue(session);

      const result = await service.createSession("user-1", "token", new Date());

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: "hashed-token",
          userAgent: null,
          ipAddress: null,
          deviceInfo: null,
        }),
      );
      expect(result.userAgent).toBeNull();
    });
  });

  describe("findByUserId", () => {
    it("returns sessions ordered by createdAt DESC", async () => {
      const sessions = [mockSession({ id: "s2" }), mockSession({ id: "s1" })];
      vi.mocked(repo.find).mockResolvedValue(sessions);

      const result = await service.findByUserId("user-1");

      expect(repo.find).toHaveBeenCalledWith({
        where: { user: { id: "user-1" } },
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual(sessions);
    });

    it("returns empty array when no sessions", async () => {
      vi.mocked(repo.find).mockResolvedValue([]);
      const result = await service.findByUserId("user-1");
      expect(result).toEqual([]);
    });
  });

  describe("findById", () => {
    it("returns session when found", async () => {
      const session = mockSession();
      vi.mocked(repo.findOne).mockResolvedValue(session);

      const result = await service.findById("session-1");

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: "session-1" },
      });
      expect(result).toEqual(session);
    });

    it("returns null when not found", async () => {
      vi.mocked(repo.findOne).mockResolvedValue(null);
      const result = await service.findById("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("revokeSession", () => {
    it("deletes session by id and userId", async () => {
      vi.mocked(repo.delete).mockResolvedValue({ affected: 1, raw: {} });

      await service.revokeSession("session-1", "user-1");

      expect(repo.delete).toHaveBeenCalledWith({
        id: "session-1",
        user: { id: "user-1" },
      });
    });
  });

  describe("revokeAllSessions", () => {
    it("deletes all sessions for user", async () => {
      vi.mocked(repo.delete).mockResolvedValue({ affected: 2, raw: {} });

      await service.revokeAllSessions("user-1");

      expect(repo.delete).toHaveBeenCalledWith({
        user: { id: "user-1" },
      });
    });

    it("deletes all sessions except the excluded one", async () => {
      const sessions = [
        mockSession({ id: "keep-me" }),
        mockSession({ id: "delete-me" }),
        mockSession({ id: "delete-me-too" }),
      ];
      vi.mocked(repo.find).mockResolvedValue(sessions);
      vi.mocked(repo.delete).mockResolvedValue({ affected: 2, raw: {} });

      await service.revokeAllSessions("user-1", "keep-me");

      expect(repo.delete).toHaveBeenCalledWith(["delete-me", "delete-me-too"]);
    });
  });

  describe("validateRefreshToken", () => {
    it("returns session when token valid and not expired", async () => {
      const session = mockSession();
      vi.mocked(repo.findOne).mockResolvedValue(session);
      vi.mocked(repo.save).mockResolvedValue(session);

      const result = await service.validateRefreshToken(
        "user-1",
        "refresh-token-1",
      );

      expect(repo.findOne).toHaveBeenCalledWith({
        where: {
          user: { id: "user-1" },
          refreshToken: "hashed-refresh-token-1",
        },
      });
      expect(result).toEqual(session);
      expect(repo.save).toHaveBeenCalled();
    });

    it("returns null when session not found", async () => {
      vi.mocked(repo.findOne).mockResolvedValue(null);

      const result = await service.validateRefreshToken(
        "user-1",
        "nonexistent",
      );

      expect(result).toBeNull();
    });

    it("removes and returns null when session expired", async () => {
      const expiredSession = mockSession({
        expiresAt: new Date(Date.now() - 3600000),
      });
      vi.mocked(repo.findOne).mockResolvedValue(expiredSession);
      vi.mocked(repo.remove).mockResolvedValue(expiredSession);

      const result = await service.validateRefreshToken(
        "user-1",
        "expired-token",
      );

      expect(repo.remove).toHaveBeenCalledWith(expiredSession);
      expect(result).toBeNull();
    });
  });

  describe("updateLastActive", () => {
    it("updates lastActiveAt", async () => {
      vi.mocked(repo.update).mockResolvedValue({ affected: 1, raw: {} });

      await service.updateLastActive("session-1");

      expect(repo.update).toHaveBeenCalledWith("session-1", {
        lastActiveAt: expect.any(Date),
      });
    });
  });

  describe("parseDeviceInfo", () => {
    it("parses Chrome on Linux", () => {
      const ua =
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
      const info = service.parseDeviceInfo(ua);
      expect(info).toEqual({
        os: "Linux",
        browser: "Chrome",
        deviceType: "desktop",
      });
    });

    it("parses Safari on macOS", () => {
      const ua =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";
      const info = service.parseDeviceInfo(ua);
      expect(info).toEqual({
        os: "macOS",
        browser: "Safari",
        deviceType: "desktop",
      });
    });

    it("parses Firefox on Windows", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0";
      const info = service.parseDeviceInfo(ua);
      expect(info).toEqual({
        os: "Windows",
        browser: "Firefox",
        deviceType: "desktop",
      });
    });

    it("detects mobile devices", () => {
      const ua =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/605.1.15";
      const info = service.parseDeviceInfo(ua);
      expect(info).toEqual({
        os: "iOS",
        browser: "Safari",
        deviceType: "mobile",
      });
    });

    it("detects Android mobile", () => {
      const ua =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36";
      const info = service.parseDeviceInfo(ua);
      expect(info).toEqual({
        os: "Android",
        browser: "Chrome",
        deviceType: "mobile",
      });
    });

    it("returns Unknown for unrecognized user agents", () => {
      const ua = "SomeRandom/1.0";
      const info = service.parseDeviceInfo(ua);
      expect(info).toEqual({
        os: "Unknown",
        browser: "Unknown",
        deviceType: "desktop",
      });
    });
  });
});
