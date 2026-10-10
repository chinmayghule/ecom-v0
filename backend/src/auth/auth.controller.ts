import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Request, Response } from "express";
import type { StringValue } from "ms";
import ms from "ms";
import { RATE_LIMITS } from "../common/rate-limits.js";
import { User } from "../entities/user.entity.js";
import { AuthService } from "./auth.service.js";
import { CurrentUser } from "./decorators/current-user.decorator.js";
import { ForgotPasswordDto } from "./dto/forgot-password.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { ResetPasswordDto } from "./dto/reset-password.dto.js";
import { SessionResponseDto } from "./dto/session-response.dto.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { RefreshTokenGuard } from "./guards/refresh-token.guard.js";
import { SessionService } from "./session.service.js";

const REFRESH_COOKIE_NAME = "refreshToken";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Built per request, never at module scope.
   *
   * A module-level `const` evaluates during the import phase, before Nest
   * instantiates anything — and `ConfigModule.forRoot()`, which loads `.env`,
   * runs at instantiation. So `process.env.NODE_ENV` there reflects only what
   * the shell exported. Render does not set `NODE_ENV=production` by default,
   * which meant `secure` evaluated to false on a production deploy and the
   * browser would attach the 7-day refresh cookie over plain HTTP. That silently
   * invalidates the reasoning for shipping no CSRF token: SameSite stops
   * cross-site use, but nothing stops a passive network attacker reading it off
   * the wire.
   *
   * `email.module.ts` was already correct — it reads NODE_ENV inside a factory.
   * This is that same pattern.
   */
  private get refreshCookieOptions(): CookieOptions {
    const isProduction =
      this.configService.get<string>("NODE_ENV") === "production";
    const maxAge =
      ms(
        (this.configService.get<string>("JWT_REFRESH_EXPIRATION", "7d") ??
          "7d") as StringValue,
      ) || 7 * 24 * 60 * 60 * 1000;

    return {
      httpOnly: true,
      secure: isProduction,
      // Never relax to "none" without reopening REQ-SEC-04. See REQ-SEC-04 in
      // the planning docs; this cookie is the only credential a cross-site
      // request could otherwise replay.
      sameSite: "strict",
      path: "/",
      maxAge,
    };
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, this.refreshCookieOptions);
  }

  @Post("register")
  @Throttle({ default: RATE_LIMITS.register })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.register(dto);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, this.refreshCookieOptions);
    return { accessToken };
  }

  @Post("login")
  @Throttle({ default: RATE_LIMITS.login })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // All policy is in AuthService.login: lockout check, attempt recording,
    // constant-cost password verification. Keeping it here meant the controller
    // needed its own user lookup and brute-force service just to duplicate the
    // service's checks, and the per-account lock was skipped entirely for
    // addresses with no user row — which is most of a leaked credential list.
    const { accessToken, refreshToken } = await this.authService.login(
      dto.email,
      dto.password,
      req.headers["user-agent"],
      req.ip,
    );
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, this.refreshCookieOptions);
    return { accessToken };
  }

  @UseGuards(RefreshTokenGuard)
  @Throttle({ default: RATE_LIMITS.refresh })
  @Post("refresh")
  async refresh(
    @CurrentUser() user: { id: string; refreshToken: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refreshAccessToken(
      user.id,
      user.refreshToken,
      req.headers["user-agent"],
      req.ip,
    );
    res.cookie(
      REFRESH_COOKIE_NAME,
      tokens.refreshToken,
      this.refreshCookieOptions,
    );
    return { accessToken: tokens.accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: { id: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Clear first, unconditionally. The previous order called the service and
    // then cleared, so the service's UnauthorizedException — thrown whenever
    // the session had already been revoked server-side — skipped the clear
    // entirely. A user in that state kept the cookie forever and every
    // subsequent logout 401'd, leaving them unable to log out.
    //
    // Logout is a client-state operation: "you are logged out" is the success
    // condition whether or not a matching session row still existed. A missing
    // or unknown token is not an error here.
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    this.clearRefreshCookie(res);

    if (refreshToken) {
      await this.authService.logout(user.id, refreshToken);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getProfile(@CurrentUser() user: { id: string }) {
    const found = await this.authService.getProfile(user.id);
    if (!found) throw new NotFoundException("User not found");
    return found;
  }

  @UseGuards(JwtAuthGuard)
  @Get("sessions")
  async getSessions(@CurrentUser() user: User) {
    const sessions = await this.sessionService.findByUserId(user.id);
    return sessions.map(
      (s) =>
        ({
          id: s.id,
          userAgent: s.userAgent,
          ipAddress: s.ipAddress,
          deviceInfo: s.deviceInfo,
          lastActiveAt: s.lastActiveAt,
          createdAt: s.createdAt,
        }) as SessionResponseDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete("sessions/:id")
  async revokeSession(@CurrentUser() user: User, @Param("id") id: string) {
    await this.sessionService.revokeSession(id, user.id);
    return { message: "Session revoked" };
  }

  @UseGuards(JwtAuthGuard)
  @Post("sessions/revoke-all")
  async revokeAllSessions(
    @CurrentUser() user: { id: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    let currentSessionId: string | undefined;

    if (refreshToken) {
      // `peekSessionId` is a pure lookup. `validateRefreshToken` writes — it
      // touches lastActiveAt and deletes the row if expired — so using it here
      // meant a read-only endpoint mutated session state and the result
      // depended on whether this endpoint had been called first.
      const session = await this.sessionService.peekSessionId(
        user.id,
        refreshToken,
      );
      currentSessionId = session?.id;
    }

    await this.sessionService.revokeAllSessions(user.id, currentSessionId);
    this.clearRefreshCookie(res);
    return { message: "All other sessions revoked" };
  }

  @Throttle({ default: RATE_LIMITS.forgotPassword })
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Throttle({ default: RATE_LIMITS.resetPassword })
  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }
}
