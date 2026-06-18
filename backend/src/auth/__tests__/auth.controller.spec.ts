import { NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { User, UserRole } from "../../entities/user.entity.js";
import { UsersService } from "../../users/users.service.js";
import { AuthController } from "../auth.controller.js";
import { AuthService } from "../auth.service.js";
import { BruteForceService } from "../brute-force.service.js";
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
  let usersService: UsersService;

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
          provide: BruteForceService,
          useValue: {
            isLocked: vi.fn().mockResolvedValue(false),
            recordFailedAttempt: vi.fn().mockResolvedValue(undefined),
            resetAttempts: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SessionService,
          useValue: {
            findByUserId: vi.fn().mockResolvedValue([]),
            revokeSession: vi.fn().mockResolvedValue(undefined),
            revokeAllSessions: vi.fn().mockResolvedValue(undefined),
            validateRefreshToken: vi.fn().mockResolvedValue(null),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findByEmail: vi.fn(),
            findById: vi.fn(),
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
            get: vi.fn(),
            getOrThrow: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
    usersService = module.get(UsersService);
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
      const user = mockUser({ id: "user-1", role: UserRole.CUSTOMER });
      vi.mocked(usersService.findByEmail).mockResolvedValue(user);
      vi.mocked(authService.validateUser).mockResolvedValue(user);

      const result = await controller.login(
        dto,
        req as Request,
        res as Response,
      );

      expect(authService.login).toHaveBeenCalledWith(
        user,
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

    it("checks brute force before validating credentials", async () => {
      const res = mockRes();
      const req = mockReq();
      const dto = { email: "test@example.com", password: "wrong" };
      const user = mockUser({ id: "user-1" });
      vi.mocked(usersService.findByEmail).mockResolvedValue(user);

      vi.mocked(authService.validateUser).mockResolvedValue(null);

      await expect(
        controller.login(dto, req as Request, res as Response),
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("POST /auth/refresh", () => {
    it("delegates to authService.refreshAccessToken and sets new cookie", async () => {
      const res = mockRes();
      const user = { id: "user-1", sessionId: "session-1" };
      const req = mockReq({
        headers: { "user-agent": "Mozilla" },
        ip: "1.2.3.4",
      });

      const result = await controller.refresh(
        user,
        req as Request,
        res as Response,
      );

      expect(authService.refreshAccessToken).toHaveBeenCalledWith(
        "user-1",
        "session-1",
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
      expect(result).toEqual({ message: "Logged out successfully" });
    });
  });

  describe("GET /auth/me", () => {
    it("returns user profile without passwordHash", async () => {
      const user = mockUser({
        id: "user-1",
        email: "test@example.com",
        passwordHash: "secret",
        name: "Test",
        role: UserRole.CUSTOMER,
      });
      vi.mocked(usersService.findById).mockResolvedValue(user);

      const result = await controller.getProfile({ id: "user-1" });

      expect(usersService.findById).toHaveBeenCalledWith("user-1");
      expect(result).not.toHaveProperty("passwordHash");
      expect(result).toHaveProperty("email", "test@example.com");
    });

    it("throws NotFoundException when user not found", async () => {
      vi.mocked(usersService.findById).mockResolvedValue(null);

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
