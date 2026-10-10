import { ExecutionContext } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { User } from "../../entities/user.entity.js";
import { UserRole } from "../../entities/user.entity.js";
import { OptionalJwtAuthGuard } from "../guards/optional-jwt-auth.guard.js";

const context = (authorization?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: authorization ? { authorization } : {} }),
    }),
  }) as unknown as ExecutionContext;

/**
 * `GET /products/:id` uses this rather than `JwtAuthGuard` because an
 * unpublished product is visible to its owner and to nobody else — which the
 * controller can only decide if it knows whether the caller is signed in.
 *
 * Passport's `AuthGuard("jwt")` rejects on a missing token. This subclass
 * exists to turn "no token" into "no user" instead of a 401, while still
 * rejecting a token that is present but invalid.
 */
describe("OptionalJwtAuthGuard", () => {
  const guard = new OptionalJwtAuthGuard();
  const user = { id: "u1", role: UserRole.SELLER } as User;

  it("attaches the user when a valid token is presented", () => {
    expect(guard.handleRequest<User>(null, user, null, context())).toEqual(
      user,
    );
  });

  it("yields undefined rather than throwing when no token is sent", () => {
    // The point of the guard: an anonymous visitor gets to read public data
    // instead of a 401.
    expect(
      guard.handleRequest<User>(null, undefined, null, context()),
    ).toBeUndefined();
  });

  // passport-jwt signals "no token" as `user === false`, not `undefined`.
  // Forwarding that would leave `request.user === false`, which is truthy, so
  // every `if (request.user)` downstream would treat the caller as signed in.
  it("normalises passport's `false` to undefined", () => {
    expect(
      guard.handleRequest<User>(null, false, null, context()),
    ).toBeUndefined();
  });

  // A forged or tampered token must not become "anonymous" — that would turn
  // an authentication failure into a silent downgrade to public access, and a
  // client holding an expired token would never learn to refresh.
  it("rejects a token that was offered but failed verification", () => {
    const err = new Error("invalid signature");
    expect(() =>
      guard.handleRequest<User>(
        err,
        false,
        null,
        context("Bearer forged.token"),
      ),
    ).toThrow(err);
  });

  it("401s rather than passing anonymous when only the header was malformed", () => {
    expect(() =>
      guard.handleRequest<User>(
        new Error("bad"),
        undefined,
        null,
        context("   "),
      ),
    ).not.toThrow();
    expect(() =>
      guard.handleRequest<User>(
        new Error("bad"),
        undefined,
        null,
        context("NotBearer"),
      ),
    ).toThrow();
  });
});
