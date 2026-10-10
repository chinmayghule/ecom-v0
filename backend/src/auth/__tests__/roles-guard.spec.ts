import { type ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "../../entities/user.entity.js";
import { RolesGuard } from "../guards/roles.guard.js";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const mockContext = (user?: {
    role?: UserRole;
  }): Partial<ExecutionContext> => ({
    switchToHttp: () =>
      ({
        getRequest: () => ({ user }),
      }) as ReturnType<ExecutionContext["switchToHttp"]>,
    getHandler: () => "handler",
    getClass: () => "class",
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: vi.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get(RolesGuard);
    reflector = module.get(Reflector);
  });

  it("allows access when no roles are required", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue([]);

    const result = guard.canActivate(
      mockContext({ role: UserRole.CUSTOMER }) as ExecutionContext,
    );

    expect(result).toBe(true);
  });

  it("allows access when user has required role", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue([UserRole.ADMIN]);

    const result = guard.canActivate(
      mockContext({ role: UserRole.ADMIN }) as ExecutionContext,
    );

    expect(result).toBe(true);
  });

  it("denies access when user lacks required role", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue([UserRole.ADMIN]);

    expect(() =>
      guard.canActivate(
        mockContext({ role: UserRole.CUSTOMER }) as ExecutionContext,
      ),
    ).toThrow(ForbiddenException);
  });

  it("allows admin bypass for any required role", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue([UserRole.SELLER]);

    const result = guard.canActivate(
      mockContext({ role: UserRole.ADMIN }) as ExecutionContext,
    );

    expect(result).toBe(true);
  });

  it("throws ForbiddenException when user has no role", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue([UserRole.CUSTOMER]);

    expect(() =>
      guard.canActivate(mockContext({}) as ExecutionContext),
    ).toThrow(ForbiddenException);
  });

  it("throws ForbiddenException when no user exists", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue([UserRole.CUSTOMER]);

    expect(() => guard.canActivate(mockContext() as ExecutionContext)).toThrow(
      ForbiddenException,
    );
  });

  it("denies access when user role does not match any required role", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue([
      UserRole.SELLER,
      UserRole.ADMIN,
    ]);

    expect(() =>
      guard.canActivate(
        mockContext({ role: UserRole.CUSTOMER }) as ExecutionContext,
      ),
    ).toThrow(ForbiddenException);
  });

  it("allows access when user matches one of multiple required roles", () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue([
      UserRole.SELLER,
      UserRole.CUSTOMER,
    ]);

    const result = guard.canActivate(
      mockContext({ role: UserRole.CUSTOMER }) as ExecutionContext,
    );

    expect(result).toBe(true);
  });
});
