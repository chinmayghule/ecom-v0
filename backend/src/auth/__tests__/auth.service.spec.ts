import { ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { User, UserRole } from "../../entities/user.entity.js";
import { UsersService } from "../../users/users.service.js";
import { AuthService } from "../auth.service.js";
import { HashService } from "../hash.service.js";
import { SessionService } from "../session.service.js";

const mockUser = (overrides: Partial<User> = {}): User =>
  ({
    id: "user-1",
    email: "test@example.com",
    passwordHash: "hashed_password",
    name: "Test User",
    role: UserRole.CUSTOMER,
    contactNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }) as User;

describe("AuthService", () => {
  let authService: AuthService;
  let usersService: UsersService;
  let hashService: HashService;
  let sessionService: SessionService;
  let jwtService: JwtService;
  let configService: ConfigService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: vi.fn(),
            findById: vi.fn(),
            create: vi.fn(),
          },
        },
        {
          provide: HashService,
          useValue: {
            hashPassword: vi.fn(),
            verifyPassword: vi.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: vi.fn().mockReturnValue("mock-access-token"),
            verify: vi.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi
              .fn()
              .mockImplementation((key: string, defaultValue?: string) => {
                const config: Record<string, string> = {
                  JWT_SECRET: "test-secret",
                  JWT_REFRESH_SECRET: "test-refresh-secret",
                  JWT_REFRESH_EXPIRATION_MS: "604800000",
                };
                return config[key] ?? defaultValue ?? null;
              }),
          },
        },
        {
          provide: SessionService,
          useValue: {
            createSession: vi.fn().mockResolvedValue({}),
            findByUserId: vi.fn(),
            revokeSession: vi.fn(),
            parseDeviceInfo: vi.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get(AuthService);
    usersService = module.get(UsersService);
    hashService = module.get(HashService);
    sessionService = module.get(SessionService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  describe("validateUser", () => {
    it("returns user when credentials are valid", async () => {
      const user = mockUser();
      vi.mocked(usersService.findByEmail).mockResolvedValue(user);
      vi.mocked(hashService.verifyPassword).mockResolvedValue(true);

      const result = await authService.validateUser(
        "test@example.com",
        "password",
      );

      expect(result).toEqual(user);
      expect(usersService.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(hashService.verifyPassword).toHaveBeenCalledWith(
        "hashed_password",
        "password",
      );
    });

    it("returns null when user not found", async () => {
      vi.mocked(usersService.findByEmail).mockResolvedValue(null);

      const result = await authService.validateUser(
        "unknown@example.com",
        "password",
      );

      expect(result).toBeNull();
    });

    it("returns null when password is wrong", async () => {
      const user = mockUser();
      vi.mocked(usersService.findByEmail).mockResolvedValue(user);
      vi.mocked(hashService.verifyPassword).mockResolvedValue(false);

      const result = await authService.validateUser(
        "test@example.com",
        "wrong-password",
      );

      expect(result).toBeNull();
    });
  });

  describe("register", () => {
    it("creates user and returns auth tokens", async () => {
      const user = mockUser();
      vi.mocked(usersService.findByEmail).mockResolvedValue(null);
      vi.mocked(hashService.hashPassword).mockResolvedValue(
        "hashed_new_password",
      );
      vi.mocked(usersService.create).mockResolvedValue(user);
      vi.mocked(sessionService.createSession).mockResolvedValue({} as any);

      const result = await authService.register({
        email: "test@example.com",
        password: "strongPass123",
        name: "Test User",
      });

      expect(result).toEqual({
        accessToken: "mock-access-token",
        refreshToken: "mock-access-token",
        user: expect.objectContaining({
          id: "user-1",
          email: "test@example.com",
        }),
      });
      expect(result.user).not.toHaveProperty("passwordHash");
      expect(hashService.hashPassword).toHaveBeenCalledWith("strongPass123");
      expect(usersService.create).toHaveBeenCalledWith({
        email: "test@example.com",
        passwordHash: "hashed_new_password",
        name: "Test User",
      });
    });

    it("throws ConflictException when email already exists", async () => {
      const existingUser = mockUser();
      vi.mocked(usersService.findByEmail).mockResolvedValue(existingUser);

      await expect(
        authService.register({
          email: "test@example.com",
          password: "strongPass123",
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("login", () => {
    it("generates token pair and creates session", async () => {
      const user = mockUser();
      vi.mocked(sessionService.createSession).mockResolvedValue({} as any);

      const result = await authService.login(user, "Mozilla/5.0", "127.0.0.1");

      expect(result).toEqual({
        accessToken: "mock-access-token",
        refreshToken: "mock-access-token",
      });
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(sessionService.createSession).toHaveBeenCalledWith(
        "user-1",
        "mock-access-token",
        expect.any(Date),
        "Mozilla/5.0",
        "127.0.0.1",
        undefined,
      );
    });

    it("works without user-agent and ip", async () => {
      const user = mockUser();
      vi.mocked(sessionService.createSession).mockResolvedValue({} as any);

      const result = await authService.login(user);

      expect(result).toEqual({
        accessToken: "mock-access-token",
        refreshToken: "mock-access-token",
      });
      expect(sessionService.createSession).toHaveBeenCalledWith(
        "user-1",
        "mock-access-token",
        expect.any(Date),
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe("refreshAccessToken", () => {
    it("returns new access token for valid refresh token", async () => {
      const user = mockUser();
      vi.mocked(jwtService.verify).mockReturnValue({ sub: "user-1" });
      vi.mocked(usersService.findById).mockResolvedValue(user);
      vi.mocked(jwtService.sign).mockReturnValue("new-access-token");

      const result = await authService.refreshAccessToken(
        "valid-refresh-token",
      );

      expect(result).toEqual({ accessToken: "new-access-token" });
      expect(jwtService.verify).toHaveBeenCalledWith("valid-refresh-token", {
        secret: "test-refresh-secret",
      });
    });

    it("throws on invalid refresh token", async () => {
      vi.mocked(jwtService.verify).mockImplementation(() => {
        throw new Error("jwt malformed");
      });

      await expect(
        authService.refreshAccessToken("invalid-token"),
      ).rejects.toThrow("Invalid or expired refresh token");
    });

    it("throws when user not found", async () => {
      vi.mocked(jwtService.verify).mockReturnValue({ sub: "nonexistent" });
      vi.mocked(usersService.findById).mockResolvedValue(null);

      await expect(
        authService.refreshAccessToken("valid-token"),
      ).rejects.toThrow("User not found");
    });
  });

  describe("logout", () => {
    it("revokes session when refresh token matches", async () => {
      const session = { id: "session-1", refreshToken: "rt-1" };
      vi.mocked(sessionService.findByUserId).mockResolvedValue([
        session,
      ] as any);

      await authService.logout("user-1", "rt-1");

      expect(sessionService.revokeSession).toHaveBeenCalledWith(
        "session-1",
        "user-1",
      );
    });

    it("does nothing when session token doesnt match", async () => {
      vi.mocked(sessionService.findByUserId).mockResolvedValue([
        { id: "session-1", refreshToken: "rt-1" },
      ] as any);

      await authService.logout("user-1", "non-matching-token");

      expect(sessionService.revokeSession).not.toHaveBeenCalled();
    });

    it("does nothing when no session token provided", async () => {
      await authService.logout("user-1");

      expect(sessionService.findByUserId).not.toHaveBeenCalled();
      expect(sessionService.revokeSession).not.toHaveBeenCalled();
    });
  });

  describe("forgotPassword", () => {
    it("returns generic message regardless of email existence", async () => {
      vi.mocked(usersService.findByEmail).mockResolvedValue(mockUser());

      const result = await authService.forgotPassword("test@example.com");

      expect(result.message).toContain("If that email is registered");
    });

    it("returns same message for unknown email", async () => {
      vi.mocked(usersService.findByEmail).mockResolvedValue(null);

      const result = await authService.forgotPassword("unknown@example.com");

      expect(result.message).toContain("If that email is registered");
    });
  });

  describe("resetPassword", () => {
    it("hashes new password and returns success", async () => {
      vi.mocked(hashService.hashPassword).mockResolvedValue(
        "hashed_new_password",
      );

      const result = await authService.resetPassword(
        "reset-token-123",
        "newPassword456",
      );

      expect(hashService.hashPassword).toHaveBeenCalledWith("newPassword456");
      expect(result.message).toBe("Password has been reset successfully.");
    });

    it("throws on empty token", async () => {
      await expect(
        authService.resetPassword("", "newPassword456"),
      ).rejects.toThrow("Invalid or expired reset token");
    });
  });
});
