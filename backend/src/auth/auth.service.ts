import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { User, UserRole } from "../entities/user.entity.js";
import { UsersService } from "../users/users.service.js";
import { RegisterDto } from "./dto/register.dto.js";
import { HashService } from "./hash.service.js";
import { SessionService } from "./session.service.js";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly hashService: HashService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const valid = await this.hashService.verifyPassword(
      user.passwordHash,
      password,
    );
    return valid ? user : null;
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException("Email already in use");

    const passwordHash = await this.hashService.hashPassword(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
    });

    return this.generateAuthResponse(user);
  }

  async login(user: User, userAgent?: string, ip?: string) {
    return this.generateTokenPair(user, userAgent, ip);
  }

  async refreshAccessToken(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException("User not found");
    return { accessToken: this.generateAccessToken(user) };
  }

  async logout(userId: string, sessionToken?: string): Promise<void> {
    if (sessionToken) {
      const sessions = await this.sessionService.findByUserId(userId);
      const session = sessions.find((s) => s.refreshToken === sessionToken);
      if (session) {
        await this.sessionService.revokeSession(session.id, userId);
      }
    }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (user) {
      this.logger.log(`[DEV] Password reset requested for ${email}`);
    }
    return {
      message:
        "If that email is registered, a password reset link has been sent.",
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    if (!token) {
      throw new Error("Invalid or expired reset token");
    }
    const passwordHash = await this.hashService.hashPassword(newPassword);
    // For Phase 1, mock: accept any non-empty token
    this.logger.log(`[DEV] Password reset with token: ${token}`);
    return { message: "Password has been reset successfully." };
  }

  private async generateAuthResponse(user: User) {
    const tokens = await this.generateTokenPair(user);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  private async generateTokenPair(user: User, userAgent?: string, ip?: string) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    const expiresAt = new Date(
      Date.now() +
        parseInt(
          this.configService.get<string>(
            "JWT_REFRESH_EXPIRATION_MS",
            "604800000",
          ),
          10,
        ),
    );

    const deviceInfo = userAgent
      ? this.sessionService.parseDeviceInfo(userAgent)
      : undefined;

    await this.sessionService.createSession(
      user.id,
      refreshToken,
      expiresAt,
      userAgent,
      ip,
      deviceInfo,
    );

    return { accessToken, refreshToken };
  }

  private generateAccessToken(user: User): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private generateRefreshToken(user: User): string {
    return this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
        expiresIn: "7d",
      },
    );
  }

  private sanitizeUser(user: User) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
