import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_SERVICE } from "../../email/email.module.js";
import type { EmailService } from "../../email/interfaces/email-service.interface.js";
import { User, UserRole } from "../../entities/user.entity.js";
import { UsersService } from "../../users/users.service.js";
import { AuthService } from "../auth.service.js";
import { BruteForceService } from "../brute-force.service.js";
import { HashService } from "../hash.service.js";
import { ResetTokenService } from "../reset-token.service.js";
import { SessionService } from "../session.service.js";
import { TokenHashService } from "../token-hash.service.js";

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
  let resetTokenService: ResetTokenService;
  let sessionService: SessionService;
  let jwtService: JwtService;
  let emailService: EmailService;

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
            update: vi.fn(),
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
                  FRONTEND_URL: "http://localhost:3000",
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
            findByRefreshTokenHash: vi.fn(),
            revokeSession: vi.fn(),
            consumeSession: vi.fn().mockResolvedValue(true),
            parseDeviceInfo: vi.fn(),
          },
        },
        {
          provide: ResetTokenService,
          useValue: {
            create: vi
              .fn()
              .mockResolvedValue({ rawToken: "mock-raw-token-abc" }),
            validate: vi.fn(),
            markUsed: vi.fn().mockResolvedValue(undefined),
          },
        },
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
          provide: BruteForceService,
          useValue: {
            isLocked: vi.fn().mockResolvedValue(false),
            recordFailedAttempt: vi.fn().mockResolvedValue(undefined),
            resetAttempts: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EMAIL_SERVICE,
          useValue: {
            send: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    authService = module.get(AuthService);
    usersService = module.get(UsersService);
    hashService = module.get(HashService);
    resetTokenService = module.get(ResetTokenService);
    sessionService = module.get(SessionService);
    jwtService = module.get(JwtService);
    emailService = module.get(EMAIL_SERVICE);
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
      vi.mocked(sessionService.createSession).mockResolvedValue(
        {} as import("../../entities/session.entity.js").Session,
      );

      const result = await authService.register({
        email: "test@example.com",
        password: "Correct-Horse-Battery-Staple-2024!",
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
      expect(hashService.hashPassword).toHaveBeenCalledWith(
        "Correct-Horse-Battery-Staple-2024!",
      );
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
          password: "Correct-Horse-Battery-Staple-2024!",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("throws BadRequestException for weak password (score < 3)", async () => {
      vi.mocked(usersService.findByEmail).mockResolvedValue(null);

      await expect(
        authService.register({
          email: "test@example.com",
          password: "password",
          name: "Test User",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("login", () => {
    it("generates token pair and creates session", async () => {
      const user = mockUser();
      vi.mocked(sessionService.createSession).mockResolvedValue(
        {} as import("../../entities/session.entity.js").Session,
      );

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
      vi.mocked(sessionService.createSession).mockResolvedValue(
        {} as import("../../entities/session.entity.js").Session,
      );

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
    it("revokes old session and returns new tokens", async () => {
      const user = mockUser();
      vi.mocked(usersService.findById).mockResolvedValue(user);
      vi.mocked(jwtService.sign).mockReturnValue("new-access-token");
      vi.mocked(sessionService.createSession).mockResolvedValue(
        {} as import("../../entities/session.entity.js").Session,
      );

      const result = await authService.refreshAccessToken(
        "user-1",
        "session-1",
        "Mozilla/5.0",
        "127.0.0.1",
      );

      expect(result).toEqual({
        accessToken: "new-access-token",
        refreshToken: "new-access-token",
      });
      expect(sessionService.consumeSession).toHaveBeenCalledWith(
        "session-1",
        "user-1",
      );
      expect(sessionService.createSession).toHaveBeenCalled();
    });

    it("throws UnauthorizedException when user not found", async () => {
      vi.mocked(usersService.findById).mockResolvedValue(null);

      await expect(
        authService.refreshAccessToken("nonexistent", "session-1"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("throws UnauthorizedException when session already consumed", async () => {
      const user = mockUser();
      vi.mocked(usersService.findById).mockResolvedValue(user);
      vi.mocked(sessionService.consumeSession).mockResolvedValue(false);

      await expect(
        authService.refreshAccessToken("user-1", "session-1"),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("logout", () => {
    it("revokes session via direct hash lookup", async () => {
      const session = { id: "session-1" };
      vi.mocked(sessionService.findByRefreshTokenHash).mockResolvedValue(
        session as import("../../entities/session.entity.js").Session,
      );

      await authService.logout("user-1", "rt-1");

      expect(sessionService.findByRefreshTokenHash).toHaveBeenCalledWith(
        "hashed-rt-1",
      );
      expect(sessionService.revokeSession).toHaveBeenCalledWith(
        "session-1",
        "user-1",
      );
    });

    it("throws UnauthorizedException when session not found", async () => {
      vi.mocked(sessionService.findByRefreshTokenHash).mockResolvedValue(null);

      await expect(
        authService.logout("user-1", "non-matching-token"),
      ).rejects.toThrow(UnauthorizedException);

      expect(sessionService.revokeSession).not.toHaveBeenCalled();
    });

    it("does nothing when no session token provided", async () => {
      await authService.logout("user-1");

      expect(sessionService.findByRefreshTokenHash).not.toHaveBeenCalled();
      expect(sessionService.revokeSession).not.toHaveBeenCalled();
    });
  });

  describe("forgotPassword", () => {
    it("creates a reset token and sends email for existing user", async () => {
      vi.mocked(usersService.findByEmail).mockResolvedValue(mockUser());
      vi.mocked(resetTokenService.create).mockResolvedValue({
        rawToken: "test-raw-token",
      });

      const result = await authService.forgotPassword("test@example.com");

      expect(resetTokenService.create).toHaveBeenCalledWith("user-1");
      expect(emailService.send).toHaveBeenCalled();
      expect(result.message).toContain("If that email is registered");
    });

    it("returns same message for unknown email without creating token", async () => {
      vi.mocked(usersService.findByEmail).mockResolvedValue(null);

      const result = await authService.forgotPassword("unknown@example.com");

      expect(resetTokenService.create).not.toHaveBeenCalled();
      expect(result.message).toContain("If that email is registered");
    });
  });

  describe("resetPassword", () => {
    it("validates token, updates password, and marks token used", async () => {
      const mockResetToken = { id: "reset-1", user: { id: "user-1" } };
      vi.mocked(resetTokenService.validate).mockResolvedValue(
        mockResetToken as import("../entities/reset-token.entity.js").ResetToken,
      );
      vi.mocked(hashService.hashPassword).mockResolvedValue(
        "hashed_new_password",
      );
      vi.mocked(usersService.update).mockResolvedValue(mockUser());

      const result = await authService.resetPassword(
        "valid-token",
        "newPass123!",
      );

      expect(resetTokenService.validate).toHaveBeenCalledWith("valid-token");
      expect(hashService.hashPassword).toHaveBeenCalledWith("newPass123!");
      expect(usersService.update).toHaveBeenCalledWith("user-1", {
        passwordHash: "hashed_new_password",
      });
      expect(resetTokenService.markUsed).toHaveBeenCalledWith("reset-1");
      expect(result.message).toBe("Password has been reset successfully.");
    });

    it("throws BadRequestException for invalid or expired token", async () => {
      vi.mocked(resetTokenService.validate).mockResolvedValue(null);

      await expect(
        authService.resetPassword("bad-token", "newPass123!"),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
