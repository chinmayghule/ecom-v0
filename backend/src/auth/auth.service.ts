import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { User } from "../entities/user.entity.js";
import { UsersService } from "../users/users.service.js";
import { EMAIL_SERVICE } from "../email/email.module.js";
import type { EmailService } from "../email/interfaces/email-service.interface.js";
import { RegisterDto } from "./dto/register.dto.js";
import { HashService } from "./hash.service.js";
import { ResetTokenService } from "./reset-token.service.js";
import { SessionService } from "./session.service.js";
import { TokenHashService } from "./token-hash.service.js";

function loadTemplate(name: string, variables: Record<string, string>): string {
  const templatePath = join(process.cwd(), "src", "email", "templates", `${name}.html`);
  let template = readFileSync(templatePath, "utf-8");
  for (const [key, value] of Object.entries(variables)) {
    template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return template;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly hashService: HashService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly resetTokenService: ResetTokenService,
    private readonly tokenHashService: TokenHashService,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
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

  async refreshAccessToken(
    userId: string,
    sessionId: string,
    userAgent?: string,
    ip?: string,
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException("User not found");

    await this.sessionService.revokeSession(sessionId, userId);

    const tokens = await this.generateTokenPair(user, userAgent, ip);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: string, sessionToken?: string): Promise<void> {
    if (sessionToken) {
      const sessions = await this.sessionService.findByUserId(userId);
      const session = sessions.find((s) =>
        this.tokenHashService.compare(sessionToken, s.refreshToken),
      );
      if (session) {
        await this.sessionService.revokeSession(session.id, userId);
      }
    }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (user) {
      const { rawToken } = await this.resetTokenService.create(user.id);
      const frontendUrl = this.configService.get<string>("FRONTEND_URL", "http://localhost:3000");
      const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
      const html = loadTemplate("password-reset", {
        RESET_URL: resetUrl,
        EXPIRY_HOURS: "1",
      });
      await this.emailService.send({
        to: user.email,
        subject: "Password Reset - Ecom",
        html,
      });
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
    const resetToken = await this.resetTokenService.validate(token);
    if (!resetToken) {
      throw new BadRequestException("Invalid or expired reset token");
    }
    const passwordHash = await this.hashService.hashPassword(newPassword);
    await this.usersService.update(resetToken.userId, { passwordHash });
    await this.resetTokenService.markUsed(resetToken.id);
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
