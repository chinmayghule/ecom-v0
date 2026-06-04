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
import type { Response } from "express";
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
import { SessionService } from "./session.service.js";

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/auth/refresh",
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
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.register(dto);
    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);
    return { accessToken };
  }

  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Req() req: any,
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

  @Post("refresh")
  async refresh(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token not found");
    }
    const { accessToken } =
      await this.authService.refreshAccessToken(refreshToken);
    return { accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refreshToken;
    await this.authService.logout(req.user.id, refreshToken);
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
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    const currentSession = refreshToken
      ? (await this.sessionService.findByUserId(req.user.id)).find(
          (s) => s.refreshToken === refreshToken,
        )
      : null;

    await this.sessionService.revokeAllSessions(
      req.user.id,
      currentSession?.id,
    );
    res.clearCookie("refreshToken", REFRESH_COOKIE_OPTIONS);
    return { message: "All other sessions revoked" };
  }

  @Post("forgot-password")
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }
}
