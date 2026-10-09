import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

/**
 * Authenticates a refresh request by verifying the token's signature only.
 *
 * It deliberately does NOT look up the session. A session lookup here would
 * reject a replayed token before the service ever saw it — the row was deleted
 * by the rotation that consumed it — so the "reuse detected, revoke the whole
 * family" branch downstream was unreachable and a stolen refresh token silently
 * produced a generic 401 instead of evicting the attacker's sessions.
 *
 * Signature verification is the only thing this guard can meaningfully assert.
 * Whether the token is still *unspent* is a question about database state, and
 * `AuthService.refreshAccessToken` answers it atomically.
 */
@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const refreshToken = request.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token not found");
    }

    let payload: { sub: string };
    try {
      payload = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    request.user = { ...request.user, id: payload.sub, refreshToken };
    return true;
  }
}
