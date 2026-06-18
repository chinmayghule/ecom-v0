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
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { User } from "../entities/user.entity.js";
import { UsersService } from "../users/users.service.js";
import { AuthService } from "./auth.service.js";
import { BruteForceService } from "./brute-force.service.js";
import { CsrfService } from "./csrf.service.js";
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
    private readonly bruteForceService: BruteForceService,
    private readonly csrfService: CsrfService,
    private readonly sessionService: SessionService,
    private readonly usersService: UsersService,
  ) {}

  @Get("csrf-token")
  getCsrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.csrfService.generateToken(req, res);
    return { csrfToken: token };
  }

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
    // Look up user before credential validation to check lockout
    const userByEmail = await this.usersService.findByEmail(dto.email);
    if (userByEmail) {
      const locked = await this.bruteForceService.isLocked(userByEmail.id);
      if (locked) {
        throw new UnauthorizedException(
          "Account temporarily locked due to too many failed attempts",
        );
      }
    }

    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      // Record failed attempt for existing users
      if (userByEmail) {
        await this.bruteForceService.recordFailedAttempt(userByEmail.id);
      }
      throw new UnauthorizedException("Invalid credentials");
    }

    // Reset attempts on successful login
    await this.bruteForceService.resetAttempts(user.id);
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

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getProfile(@CurrentUser() user: { id: string }) {
    const found = await this.usersService.findById(user.id);
    if (!found) throw new NotFoundException("User not found");
    const { passwordHash, ...profile } = found;
    return profile;
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

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }
}
