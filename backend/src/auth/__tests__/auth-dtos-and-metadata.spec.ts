import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { UserRole } from "../../entities/user.entity.js";
import {
  CHECK_POLICIES_KEY,
  CheckPolicies,
} from "../decorators/check-policies.decorator.js";
import { CurrentUser } from "../decorators/current-user.decorator.js";
import { IS_PUBLIC_KEY, Public } from "../decorators/public.decorator.js";
import { ROLES_KEY, Roles } from "../decorators/roles.decorator.js";
import { ForgotPasswordDto } from "../dto/forgot-password.dto.js";
import { LoginDto } from "../dto/login.dto.js";
import { RegisterDto } from "../dto/register.dto.js";
import { ProductPolicy } from "../policies/product.policy.js";

/**
 * Route metadata.
 *
 * Each decorator writes a distinct key. A collision — two decorators sharing a
 * key, or one overwriting another's value — would let a handler's intent
 * satisfy a guard it was never checked against, and that failure is silent.
 */
describe("route metadata decorators", () => {
  it("CheckPolicies records handlers under its own key", () => {
    class Ctrl {
      @CheckPolicies({ policyClass: ProductPolicy, method: "canEdit" })
      handler() {}
    }
    expect(
      Reflect.getMetadata(CHECK_POLICIES_KEY, Ctrl.prototype.handler),
    ).toEqual([{ policyClass: ProductPolicy, method: "canEdit" }]);
  });

  // `CheckPolicies(...handlers)` takes whole `PolicyHandler` objects, not a
  // positional (class, method) pair — `PoliciesGuard` reads
  // `handler.policyClass` / `handler.method`. The positional form stores raw
  // arguments, so the guard would look up `undefined` and fail at runtime.
  // TypeScript rejects the positional form (a string is not a `PolicyHandler`),
  // but this assertion documents the shape for anyone writing plain JS.
  it("stores arguments verbatim, so the object form is the only safe one", () => {
    class Ctrl {
      @CheckPolicies({ policyClass: ProductPolicy, method: "canEdit" })
      handler() {}
    }
    const stored = Reflect.getMetadata(
      CHECK_POLICIES_KEY,
      Ctrl.prototype.handler,
    );
    expect(stored[0].policyClass).toBe(ProductPolicy);
    expect(typeof stored[0].method).toBe("string");
  });

  it("Public records a marker under its own key", () => {
    class Ctrl {
      @Public()
      handler() {}
    }
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, Ctrl.prototype.handler)).toBe(
      true,
    );
  });

  it("Roles records every role it is given", () => {
    class Ctrl {
      @Roles(UserRole.SELLER, UserRole.ADMIN)
      handler() {}
    }
    expect(Reflect.getMetadata(ROLES_KEY, Ctrl.prototype.handler)).toEqual([
      UserRole.SELLER,
      UserRole.ADMIN,
    ]);
  });

  it("CurrentUser resolves to a parameter decorator", () => {
    expect(typeof CurrentUser).toBe("function");
  });
});

/**
 * Auth DTOs, through the same transform → validate pipeline the global
 * `ValidationPipe` runs.
 *
 * The email lowercasing matters beyond cosmetics: the unique constraint on
 * `users.email` is what registration's conflict check leans on, so two
 * differently-cased spellings of one address must collapse to a single row.
 */
describe("auth DTOs", () => {
  const run = async <T extends object>(cls: new () => T, plain: object) =>
    validate(plainToInstance(cls, plain));

  describe("LoginDto", () => {
    // Lowercased, not trimmed. Casing is the one that matters: the unique
    // constraint on `users.email` would otherwise treat "User@x.com" and
    // "user@x.com" as two accounts. Surrounding whitespace is left in place for
    // `@IsEmail` to reject, which is the stricter outcome.
    it("lowercases the email so casing cannot split one account in two", async () => {
      const dto = plainToInstance(LoginDto, {
        email: "User@Example.COM",
        password: "x",
      });
      await validate(dto);
      expect(dto.email).toBe("user@example.com");
    });

    it("rejects an email with surrounding whitespace", async () => {
      const errors = await validate(
        plainToInstance(LoginDto, { email: " a@b.com ", password: "x" }),
      );
      expect(errors.map((e) => e.property)).toContain("email");
    });

    it("rejects a malformed email", async () => {
      const errors = await run(LoginDto, { email: "nope", password: "x" });
      expect(errors.map((e) => e.property)).toContain("email");
    });

    it("requires a password", async () => {
      const errors = await run(LoginDto, { email: "a@b.com" });
      expect(errors.map((e) => e.property)).toContain("password");
    });
  });

  describe("ForgotPasswordDto", () => {
    it("accepts a valid address", async () => {
      expect(
        await run(ForgotPasswordDto, { email: "user@example.com" }),
      ).toHaveLength(0);
    });

    it("rejects an invalid address", async () => {
      const errors = await run(ForgotPasswordDto, { email: "not-an-email" });
      expect(errors.map((e) => e.property)).toContain("email");
    });
  });

  describe("RegisterDto", () => {
    const base = {
      email: "user@example.com",
      password: "Correct-Horse-Battery-Staple-2024!",
      name: "Test",
    };

    it("accepts a well-formed registration", async () => {
      expect(await run(RegisterDto, base)).toHaveLength(0);
    });

    it("rejects a weak password", async () => {
      const errors = await run(RegisterDto, { ...base, password: "password" });
      expect(errors.map((e) => e.property)).toContain("password");
    });

    it("rejects a missing email", async () => {
      const errors = await run(RegisterDto, { ...base, email: "" });
      expect(errors.map((e) => e.property)).toContain("email");
    });
  });
});
