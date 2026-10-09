import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { User, UserRole } from "../../entities/user.entity.js";
import { AuthController } from "../auth.controller.js";
import { AuthService } from "../auth.service.js";
import { SessionService } from "../session.service.js";

const mockUser = (overrides: Partial<User> = {}): User =>
  ({
    id: "user-1",
    email: "test@example.com",
    passwordHash: "hashed",
    name: "Test User",
    role: UserRole.CUSTOMER,
    contactNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }) as User;

describe("AuthController", () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockRes = (): Partial<Response> => ({
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
  });

  const mockReq = (overrides: Partial<Request> = {}): Partial<Request> => ({
    headers: {},
    ip: "127.0.0.1",
    cookies: {},
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: vi.fn().mockResolvedValue({
              accessToken: "mock-access",
              refreshToken: "mock-refresh",
            }),
            validateUser: vi.fn(),
            login: vi.fn().mockResolvedValue({
              accessToken: "mock-access",
              refreshToken: "mock-refresh",
            }),
            refreshAccessToken: vi.fn().mockResolvedValue({
              accessToken: "new-access",
              refreshToken: "new-refresh",
            }),
            logout: vi.fn().mockResolvedValue(undefined),
            getProfile: vi.fn(),
            forgotPassword: vi.fn().mockResolvedValue({
              message:
                "If that email is registered, a password reset link has been sent.",
            }),
            resetPassword: vi.fn().mockResolvedValue({
              message: "Password has been reset successfully.",
            }),
          },
        },
        {
          provide: SessionService,
          useValue: {
            findByUserId: vi.fn().mockResolvedValue([]),
            revokeSession: vi.fn().mockResolvedValue(undefined),
            revokeAllSessions: vi.fn().mockResolvedValue(undefined),
            validateRefreshToken: vi.fn().mockResolvedValue(null),
            peekSessionId: vi.fn().mockResolvedValue(null),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verify: vi.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockImplementation((_k: string, d?: string) => d),
            getOrThrow: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
  });

  describe("POST /auth/register", () => {
    it("delegates to authService.register and sets refresh cookie", async () => {
      const res = mockRes();
      const dto = {
        email: "test@example.com",
        password: "StrongPass123!",
        name: "Test",
      };

      const result = await controller.register(dto, res as Response);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "mock-refresh",
        expect.any(Object),
      );
      expect(result).toEqual({ accessToken: "mock-access" });
    });
  });

  describe("POST /auth/login", () => {
    it("delegates to authService and sets refresh cookie on success", async () => {
      const res = mockRes();
      const req = mockReq();
      const dto = { email: "test@example.com", password: "password" };

      const result = await controller.login(
        dto,
        req as Request,
        res as Response,
      );

      // Policy (lockout, attempt recording, constant-cost verification) lives in
      // AuthService. The controller must not re-implement any of it — that is
      // how the per-account lock ended up skipped for unknown addresses.
      expect(authService.login).toHaveBeenCalledWith(
        dto.email,
        dto.password,
        req.headers["user-agent"],
        req.ip,
      );
      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "mock-refresh",
        expect.any(Object),
      );
      expect(result).toEqual({ accessToken: "mock-access" });
    });

    it("propagates a rejected login without setting a cookie", async () => {
      const res = mockRes();
      const req = mockReq();
      const dto = { email: "test@example.com", password: "wrong" };

      vi.mocked(authService.login).mockRejectedValue(
        new UnauthorizedException("Invalid credentials"),
      );

      await expect(
        controller.login(dto, req as Request, res as Response),
      ).rejects.toThrow("Invalid credentials");

      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe("POST /auth/refresh", () => {
    it("delegates to authService.refreshAccessToken and sets new cookie", async () => {
      const res = mockRes();
      const user = { id: "user-1", refreshToken: "rt-1" };
      const req = mockReq({
        headers: { "user-agent": "Mozilla" },
        ip: "1.2.3.4",
      });

      const result = await controller.refresh(
        user,
        req as Request,
        res as Response,
      );

      // The raw token, not a session id: the service spends it atomically by
      // hash, because a replayed token has no row left to read an id from.
      expect(authService.refreshAccessToken).toHaveBeenCalledWith(
        "user-1",
        "rt-1",
        "Mozilla",
        "1.2.3.4",
      );
      expect(res.cookie).toHaveBeenCalledWith(
        "refreshToken",
        "new-refresh",
        expect.any(Object),
      );
      expect(result).toEqual({ accessToken: "new-access" });
    });
  });

  describe("POST /auth/logout", () => {
    it("delegates to authService.logout and clears cookie", async () => {
      const res = mockRes();
      const req = mockReq({ cookies: { refreshToken: "rt-1" } });
      const user = { id: "user-1" };

      const result = await controller.logout(
        user,
        req as Request,
        res as Response,
      );

      expect(authService.logout).toHaveBeenCalledWith("user-1", "rt-1");
      expect(res.clearCookie).toHaveBeenCalledWith(
        "refreshToken",
        expect.any(Object),
      );
      // 204 No Content. Logging out is a client-state outcome, not a payload.
      expect(result).toBeUndefined();
    });

    it("clears the cookie even when revoking the session fails", async () => {
      const res = mockRes();
      const req = mockReq({ cookies: { refreshToken: "rt-stale" } });
      vi.mocked(authService.logout).mockRejectedValue(new Error("boom"));

      await expect(
        controller.logout({ id: "user-1" }, req as Request, res as Response),
      ).rejects.toThrow("boom");

      // Clearing happens BEFORE the service call precisely so this is true.
      // Clearing afterwards meant a failure left the client holding a cookie it
      // could never remove, and every subsequent logout 401'd.
      expect(res.clearCookie).toHaveBeenCalled();
    });

    it("still clears the cookie when no token is present", async () => {
      const res = mockRes();
      const req = mockReq({ cookies: {} });

      await controller.logout(
        { id: "user-1" },
        req as Request,
        res as Response,
      );

      expect(res.clearCookie).toHaveBeenCalled();
      expect(authService.logout).not.toHaveBeenCalled();
    });
  });

  describe("GET /auth/me", () => {
    it("returns user profile without passwordHash", async () => {
      const _user = mockUser({
        id: "user-1",
        email: "test@example.com",
        passwordHash: "secret",
        name: "Test",
        role: UserRole.CUSTOMER,
      });
      vi.mocked(authService.getProfile).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        name: "Test",
        role: UserRole.CUSTOMER,
      } as never);

      const result = await controller.getProfile({ id: "user-1" });

      expect(authService.getProfile).toHaveBeenCalledWith("user-1");
      expect(result).not.toHaveProperty("passwordHash");
      expect(result).toHaveProperty("email", "test@example.com");
    });

    it("throws NotFoundException when user not found", async () => {
      vi.mocked(authService.getProfile).mockResolvedValue(null);

      await expect(
        controller.getProfile({ id: "nonexistent" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("POST /auth/forgot-password", () => {
    it("delegates to authService.forgotPassword", async () => {
      const dto = { email: "test@example.com" };

      const result = await controller.forgotPassword(dto);

      expect(authService.forgotPassword).toHaveBeenCalledWith(
        "test@example.com",
      );
      expect(result.message).toContain("If that email is registered");
    });
  });

  describe("POST /auth/reset-password", () => {
    it("delegates to authService.resetPassword", async () => {
      const dto = { token: "valid-token", password: "NewPass123!" };

      const result = await controller.resetPassword(dto);

      expect(authService.resetPassword).toHaveBeenCalledWith(
        "valid-token",
        "NewPass123!",
      );
      expect(result.message).toBe("Password has been reset successfully.");
    });
  });
});
