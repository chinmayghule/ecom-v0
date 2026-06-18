import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "../../entities/user.entity.js";
import { JwtStrategy } from "../strategies/jwt.strategy.js";

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: "test-secret-for-jwt-strategy-test",
          signOptions: { expiresIn: "15m" },
        }),
      ],
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi
              .fn()
              .mockReturnValue("test-secret-for-jwt-strategy-test"),
          },
        },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  it("returns user object from valid payload", async () => {
    const payload = {
      sub: "user-1",
      email: "test@example.com",
      role: UserRole.CUSTOMER,
    };

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      id: "user-1",
      email: "test@example.com",
      role: UserRole.CUSTOMER,
    });
  });

  it("returns user object with seller role", async () => {
    const payload = {
      sub: "seller-1",
      email: "seller@example.com",
      role: UserRole.SELLER,
    };

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      id: "seller-1",
      email: "seller@example.com",
      role: UserRole.SELLER,
    });
  });

  it("returns user object with admin role", async () => {
    const payload = {
      sub: "admin-1",
      email: "admin@example.com",
      role: UserRole.ADMIN,
    };

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      id: "admin-1",
      email: "admin@example.com",
      role: UserRole.ADMIN,
    });
  });

  it("handles additional unknown payload fields gracefully", async () => {
    const payload = {
      sub: "user-1",
      email: "test@example.com",
      role: UserRole.CUSTOMER,
      iat: 1234567890,
      exp: 1234568490,
    };

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      id: "user-1",
      email: "test@example.com",
      role: UserRole.CUSTOMER,
    });
  });
});
