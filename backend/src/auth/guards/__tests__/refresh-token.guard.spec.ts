import { type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshTokenGuard } from "../refresh-token.guard.js";

function mockExecutionContext(
  cookies: Record<string, string>,
  existingUser?: Record<string, unknown>,
): Partial<ExecutionContext> {
  const request: Record<string, unknown> = { cookies };
  if (existingUser) request.user = existingUser;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
}

function requestOf(context: Partial<ExecutionContext>) {
  return context.switchToHttp().getRequest() as {
    user: Record<string, unknown>;
  };
}

/**
 * The guard verifies the refresh token's SIGNATURE and nothing else.
 *
 * It used to also look up the session. That made it impossible for a replayed
 * token to ever reach the reuse-detection branch downstream: the row was already
 * deleted by the rotation that consumed it, so the guard threw a generic
 * "Session not found or expired" and the attacker's other sessions survived.
 * Whether a token is still unspent is database state, and one atomic
 * `DELETE ... RETURNING` answers it correctly under concurrency.
 */
describe("RefreshTokenGuard", () => {
  let guard: RefreshTokenGuard;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RefreshTokenGuard,
        {
          provide: JwtService,
          useValue: { verify: vi.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue("test-refresh-secret"),
          },
        },
      ],
    }).compile();

    guard = module.get(RefreshTokenGuard);
    jwtService = module.get(JwtService);
  });

  it("verifies against the refresh secret, not the access secret", async () => {
    vi.mocked(jwtService.verify).mockReturnValue({ sub: "user-1" });

    await guard.canActivate(
      mockExecutionContext({ refreshToken: "rt-abc" }) as ExecutionContext,
    );

    expect(jwtService.verify).toHaveBeenCalledWith("rt-abc", {
      secret: "test-refresh-secret",
    });
  });

  it("attaches the subject and the token to the request", async () => {
    vi.mocked(jwtService.verify).mockReturnValue({ sub: "user-1" });

    const context = mockExecutionContext({ refreshToken: "rt-abc" });
    await guard.canActivate(context as ExecutionContext);

    expect(requestOf(context).user).toMatchObject({
      id: "user-1",
      refreshToken: "rt-abc",
    });
  });

  it("preserves fields set by an earlier guard", async () => {
    vi.mocked(jwtService.verify).mockReturnValue({ sub: "user-1" });

    const context = mockExecutionContext(
      { refreshToken: "rt-abc" },
      {
        traceId: "abc",
      },
    );
    await guard.canActivate(context as ExecutionContext);

    expect(requestOf(context).user).toMatchObject({
      traceId: "abc",
      id: "user-1",
    });
  });

  it("does not consult session state at all", async () => {
    // Documents the deliberate removal of the session lookup. If a lookup were
    // reintroduced, a replayed token would be rejected here with a generic 401
    // and reuse detection downstream would become unreachable again.
    vi.mocked(jwtService.verify).mockReturnValue({ sub: "user-1" });

    const context = mockExecutionContext({ refreshToken: "spent-token" });
    await expect(guard.canActivate(context as ExecutionContext)).resolves.toBe(
      true,
    );
    expect(requestOf(context).user).toMatchObject({
      refreshToken: "spent-token",
    });
  });

  it("throws when no refresh token cookie is present", async () => {
    await expect(
      guard.canActivate(mockExecutionContext({}) as ExecutionContext),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("throws when signature verification fails", async () => {
    vi.mocked(jwtService.verify).mockImplementation(() => {
      throw new Error("invalid signature");
    });

    await expect(
      guard.canActivate(
        mockExecutionContext({ refreshToken: "forged" }) as ExecutionContext,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("throws on an expired token", async () => {
    vi.mocked(jwtService.verify).mockImplementation(() => {
      throw new Error("jwt expired");
    });

    await expect(
      guard.canActivate(
        mockExecutionContext({ refreshToken: "expired" }) as ExecutionContext,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
