import {
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import type { User } from "../../entities/user.entity.js";

/**
 * Parses a bearer token when one is present and lets the request through either
 * way.
 *
 * `GET /products/:id` is public, but it is not *anonymous*: the owner of an
 * unpublished product has to be able to read their own draft. `JwtAuthGuard`
 * cannot express that — it 401s on a missing token, which would close the route
 * to the public entirely, and removing the guard would leave `request.user`
 * permanently undefined so the owner would get a 404 on their own listing.
 *
 * The subclass exists because `handleRequest` is the only seam Passport offers:
 * `AuthGuard`'s `canActivate` always delegates the decision to it.
 *
 * The important distinction is between *no token* and *a bad token*. Both reach
 * this method with something falsy in `user`, so they are told apart by looking
 * at the request:
 *
 *   - no `Authorization` header → the caller is anonymous → allow
 *   - a header that failed verification → the caller is lying or their token
 *     expired → 401
 *
 * Collapsing both to anonymous would mean a forged or expired token is silently
 * downgraded to public access instead of being rejected. Here that is only
 * harmless because the route hands out public data anyway; on any route where
 * anonymous means less, the same shortcut would turn an authentication failure
 * into a quiet success. It fails in the safe direction today and would not on
 * the next route it is copied to.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<TUser = User>(
    err: unknown,
    // biome-ignore lint/suspicious/noExplicitAny: passport's AuthGuard contract types the resolved user as `any`
    user: any,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (!err && user) return user as TUser;

    // `user === false` is how passport-jwt reports a token it parsed but
    // rejected. Returning that value onward would leave `request.user ===
    // false`, which is truthy — every downstream `if (request.user)` would read
    // the caller as signed in. Normalise it to undefined.
    const request = context.switchToHttp().getRequest<Request>();
    const presented = request.headers?.authorization;
    const hadToken =
      typeof presented === "string" && presented.trim().length > 0;

    if (!hadToken) return undefined as TUser;

    // A token was offered and refused. That is an authentication failure, and
    // it must not be reported to the client as "you are anonymous" — a client
    // holding an expired token needs to know to refresh, not to retry silently.
    throw err instanceof Error ? err : new UnauthorizedException();
  }
}
