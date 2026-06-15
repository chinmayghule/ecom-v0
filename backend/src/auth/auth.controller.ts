import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { User } from "../entities/user.entity.js";
import { UsersService } from "../users/users.service.js";
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

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly usersService: UsersService,
  ) {}

  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.register(dto);
    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken };
  }

  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException("Invalid credentials");
    const { accessToken, refreshToken } = await this.authService.login(
      user,
      req.headers["user-agent"],
      req.ip,
    );
    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken };
  }

  @UseGuards(RefreshTokenGuard)
  @Post("refresh")
  async refresh(
    @CurrentUser() user: { id: string; sessionId: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refreshAccessToken(
      user.id,
      user.sessionId,
      req.headers["user-agent"],
      req.ip,
    );
    res.cookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken: tokens.accessToken };
  }

  @UseGuards(JwtAuthGuard, RefreshTokenGuard)
  @Post("logout")
  async logout(
    @CurrentUser() user: { id: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    await this.authService.logout(user.id, refreshToken);
    res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);
    return { message: "Logged out successfully" };
  }

  @UseGuards(JwtAuthGuard, RefreshTokenGuard)
  @Get("me")
  async getProfile(@CurrentUser() user: { id: string }) {
    const found = await this.usersService.findById(user.id);
    if (!found) throw new NotFoundException("User not found");
    const { passwordHash, ...profile } = found;
    return profile;
  }

  @UseGuards(JwtAuthGuard, RefreshTokenGuard)
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

  @UseGuards(JwtAuthGuard, RefreshTokenGuard)
  @Delete("sessions/:id")
  async revokeSession(@CurrentUser() user: User, @Param("id") id: string) {
    await this.sessionService.revokeSession(id, user.id);
    return { message: "Session revoked" };
  }

  @UseGuards(JwtAuthGuard, RefreshTokenGuard)
  @Post("sessions/revoke-all")
  async revokeAllSessions(
    @CurrentUser() user: { id: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    let currentSessionId: string | undefined;

    if (refreshToken) {
      const validated = await this.sessionService.validateRefreshToken(
        user.id,
        refreshToken,
      );
      currentSessionId = validated?.id;
    }

    await this.sessionService.revokeAllSessions(user.id, currentSessionId);
    res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);
    return { message: "All other sessions revoked" };
  }

  @Throttle({ default: { limit: 1, ttl: 60000 } })
  @Post("forgot-password")
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }
}
