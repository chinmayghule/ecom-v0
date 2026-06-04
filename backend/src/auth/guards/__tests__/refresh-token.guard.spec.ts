import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionService } from "../../session.service.js";
import { RefreshTokenGuard } from "../refresh-token.guard.js";

function mockExecutionContext(cookies: Record<string, string>) {
  const request: Record<string, unknown> = { cookies };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe("RefreshTokenGuard", () => {
  let guard: RefreshTokenGuard;
  let jwtService: JwtService;
  let sessionService: SessionService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RefreshTokenGuard,
        {
          provide: JwtService,
          useValue: {
            verify: vi.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue("test-refresh-secret"),
          },
        },
        {
          provide: SessionService,
          useValue: {
            validateRefreshToken: vi.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get(RefreshTokenGuard);
    jwtService = module.get(JwtService);
    sessionService = module.get(SessionService);
  });

  it("returns true with valid refresh token and valid session", async () => {
    vi.mocked(jwtService.verify).mockReturnValue({ sub: "user-1" });
    vi.mocked(sessionService.validateRefreshToken).mockResolvedValue({
      id: "session-1",
    } as any);

    const context = mockExecutionContext({ refreshToken: "valid-token" });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(jwtService.verify).toHaveBeenCalledWith("valid-token", {
      secret: "test-refresh-secret",
    });
    expect(sessionService.validateRefreshToken).toHaveBeenCalledWith(
      "user-1",
      "valid-token",
    );
    const req = context.switchToHttp().getRequest();
    expect(req.user).toEqual({ id: "user-1", sessionId: "session-1" });
  });

  it("preserves existing request.user fields from JwtAuthGuard", async () => {
    vi.mocked(jwtService.verify).mockReturnValue({ sub: "user-1" });
    vi.mocked(sessionService.validateRefreshToken).mockResolvedValue({
      id: "session-1",
    } as any);

    const context = mockExecutionContext({ refreshToken: "valid-token" });
    const req = context.switchToHttp().getRequest();
    req.user = {
      id: "user-1",
      email: "test@example.com",
      role: "customer",
    };

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(req.user).toEqual({
      id: "user-1",
      email: "test@example.com",
      role: "customer",
      sessionId: "session-1",
    });
  });

  it("throws UnauthorizedException when no refresh token cookie", async () => {
    const context = mockExecutionContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("throws UnauthorizedException when JWT verification fails", async () => {
    vi.mocked(jwtService.verify).mockImplementation(() => {
      throw new Error("jwt malformed");
    });

    const context = mockExecutionContext({ refreshToken: "bad-token" });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("throws UnauthorizedException when session not found", async () => {
    vi.mocked(jwtService.verify).mockReturnValue({ sub: "user-1" });
    vi.mocked(sessionService.validateRefreshToken).mockResolvedValue(null);

    const context = mockExecutionContext({ refreshToken: "valid-token" });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
