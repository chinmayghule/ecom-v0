import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { getDataSourceToken } from "@nestjs/typeorm";
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
  let manager: {
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findOneOrFail: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    manager = {
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
      findOneOrFail: vi.fn(),
    };

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
                  JWT_REFRESH_EXPIRATION: "7d",
                  JWT_ACCESS_EXPIRATION: "15m",
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
            consumeSessionByTokenHash: vi
              .fn()
              .mockResolvedValue({ id: "session-1" }),
            revokeAllSessions: vi.fn().mockResolvedValue(undefined),
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
            claim: vi.fn().mockResolvedValue(true),
            findByToken: vi.fn(),
            revokeOutstanding: vi.fn().mockResolvedValue(undefined),
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
            recordFailedAttempt: vi.fn().mockResolvedValue({
              failedAttempts: 1,
              lockedUntil: null,
              locked: false,
            }),
            resetAttempts: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: getDataSourceToken(),
          useValue: {
            transaction: vi
              .fn()
              .mockImplementation(async (cb: (m: unknown) => Promise<void>) =>
                cb(manager),
              ),
            manager: { query: vi.fn() },
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

      vi.mocked(usersService.findByEmail).mockResolvedValue(user);
      vi.mocked(hashService.verifyPassword).mockResolvedValue(true);

      const result = await authService.login(
        user.email,
        "password",
        "Mozilla/5.0",
        "127.0.0.1",
      );

      expect(result).toMatchObject({
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

      vi.mocked(usersService.findByEmail).mockResolvedValue(user);
      vi.mocked(hashService.verifyPassword).mockResolvedValue(true);

      const result = await authService.login(user.email, "any-password");

      expect(result).toMatchObject({
        accessToken: "mock-access-token",
        refreshToken: "mock-access-token",
      });
      // The password hash must never ride out on the login response.
      expect(result.user).not.toHaveProperty("passwordHash");
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
        "rt-1",
        "Mozilla/5.0",
        "127.0.0.1",
      );

      expect(result).toEqual({
        accessToken: "new-access-token",
        refreshToken: "new-access-token",
      });
      // Keyed on the token hash: a replayed token has no session row left to
      // read an id from, so the hash is the only stable handle.
      expect(sessionService.consumeSessionByTokenHash).toHaveBeenCalledWith(
        "hashed-rt-1",
        "user-1",
      );
      expect(sessionService.createSession).toHaveBeenCalled();
    });

    it("throws UnauthorizedException when user not found", async () => {
      vi.mocked(usersService.findById).mockResolvedValue(null);

      await expect(
        authService.refreshAccessToken("nonexistent", "rt-1"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("revokes every session when a refresh token is replayed", async () => {
      const user = mockUser();
      vi.mocked(usersService.findById).mockResolvedValue(user);
      vi.mocked(sessionService.consumeSessionByTokenHash).mockResolvedValue(
        null,
      );

      await expect(
        authService.refreshAccessToken("user-1", "rt-1"),
      ).rejects.toThrow(UnauthorizedException);

      // Replay means the token was copied. Leaving the other sessions alive gave
      // an attacker an independent 7-day session that the victim's own logout
      // could not see.
      expect(sessionService.revokeAllSessions).toHaveBeenCalledWith("user-1");
    });

    it("does not revoke anything on a normal rotation", async () => {
      const user = mockUser();
      vi.mocked(usersService.findById).mockResolvedValue(user);
      vi.mocked(sessionService.consumeSessionByTokenHash).mockResolvedValue({
        id: "session-1",
      });
      vi.mocked(sessionService.createSession).mockResolvedValue(
        {} as import("../../entities/session.entity.js").Session,
      );

      await authService.refreshAccessToken("user-1", "rt-1");

      expect(sessionService.revokeAllSessions).not.toHaveBeenCalled();
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

    it("is a no-op rather than an error when the session is already gone", async () => {
      vi.mocked(sessionService.findByRefreshTokenHash).mockResolvedValue(null);

      // Throwing here used to abort the controller before clearCookie ran, so a
      // user whose session was revoked server-side could never clear the cookie.
      await expect(
        authService.logout("user-1", "non-matching-token"),
      ).resolves.toBeUndefined();

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
    it("claims the token, sets the password, and revokes all sessions", async () => {
      vi.mocked(resetTokenService.findByToken).mockResolvedValue({
        id: "reset-1",
        user: { id: "user-1" },
      } as import("../entities/reset-token.entity.js").ResetToken);
      vi.mocked(hashService.hashPassword).mockResolvedValue(
        "hashed_new_password",
      );

      const result = await authService.resetPassword(
        "valid-token",
        "newPass123!",
      );

      // Claim first, atomically — see the concurrency test in
      // src/integration/reset-token.integration.spec.ts.
      expect(resetTokenService.claim).toHaveBeenCalledWith(
        "valid-token",
        expect.anything(),
      );
      expect(hashService.hashPassword).toHaveBeenCalledWith("newPass123!");
      expect(manager.update).toHaveBeenCalledWith(
        expect.anything(),
        { id: "user-1" },
        { passwordHash: "hashed_new_password" },
      );
      // Without this, an attacker who already held a session kept it after the
      // user changed their password, so recovery did not actually evict them.
      expect(manager.delete).toHaveBeenCalledWith(expect.anything(), {
        user: { id: "user-1" },
      });
      expect(result.message).toBe("Password has been reset successfully.");
    });

    it("rejects without changing anything when the token was already claimed", async () => {
      vi.mocked(resetTokenService.claim).mockResolvedValue(false);

      await expect(
        authService.resetPassword("already-used-token", "newPass123!"),
      ).rejects.toThrow(BadRequestException);

      // Nothing must happen after a failed claim — no password write, and
      // crucially no session revocation that would log the real user out.
      expect(hashService.hashPassword).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it("throws BadRequestException for invalid or expired token", async () => {
      vi.mocked(resetTokenService.validate).mockResolvedValue(null);

      await expect(
        authService.resetPassword("bad-token", "newPass123!"),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
