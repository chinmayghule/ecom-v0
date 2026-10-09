import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectDataSource } from "@nestjs/typeorm";
import type { StringValue } from "ms";
import ms from "ms";
import { DataSource } from "typeorm";
import { zxcvbn } from "zxcvbn-ts";
import { EMAIL_SERVICE } from "../email/email.module.js";
import type { EmailService } from "../email/interfaces/email-service.interface.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";
import { UsersService } from "../users/users.service.js";
import { BruteForceService } from "./brute-force.service.js";
import { RegisterDto } from "./dto/register.dto.js";
import { HashService } from "./hash.service.js";
import { ResetTokenService } from "./reset-token.service.js";
import { SessionService } from "./session.service.js";
import { TokenHashService } from "./token-hash.service.js";

@Injectable()
export class AuthService {
  private get refreshDuration(): StringValue {
    return (this.configService.get<string>("JWT_REFRESH_EXPIRATION", "7d") ??
      "7d") as StringValue;
  }

  private get refreshDurationMs(): number {
    return ms(this.refreshDuration);
  }

  /**
   * A real Argon2id hash of a random value nobody knows, used to keep the cost
   * of a login attempt constant whether or not the account exists. Parameters
   * match `HashService` so the timing does too. Regenerate with:
   *   node -e "require('argon2').hash('x'+require('crypto').randomBytes(16).toString('hex'),{type:require('argon2').argon2id,memoryCost:37888,timeCost:2,parallelism:1}).then(console.log)"
   */
  private static readonly DUMMY_HASH =
    "$argon2id$v=19$m=37888,t=2,p=1$p++NUYYRuR6fsc2s+F6dIA$RVSqA/noSInNEmb+96/7DxGASMkI288PPm8vVzFOSDA";

  constructor(
    private readonly usersService: UsersService,
    private readonly hashService: HashService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly resetTokenService: ResetTokenService,
    private readonly tokenHashService: TokenHashService,
    private readonly bruteForceService: BruteForceService,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
  ) {}

  /** Current user for `GET /auth/me`, with the password hash stripped. */
  async getProfile(userId: string): Promise<Omit<User, "passwordHash"> | null> {
    const found = await this.usersService.findById(userId);
    return found ? this.sanitizeUser(found) : null;
  }

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

    // Service-level password strength check with user-specific inputs
    const zxcvbnResult = zxcvbn(dto.password, [dto.email, dto.name ?? ""]);
    if (zxcvbnResult.score < 2) {
      const feedback = zxcvbnResult.feedback?.suggestions?.join(" ") ?? "";
      throw new BadRequestException(`Password is too weak. ${feedback}`.trim());
    }

    const passwordHash = await this.hashService.hashPassword(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
    });

    return this.generateAuthResponse(user);
  }

  /**
   * Verifies credentials, then mints a token pair.
   *
   * The policy lives here rather than in the controller so there is one place
   * that decides what a failed login means. Every step is a guard clause: reject
   * and return, otherwise fall through. The happy path reads top to bottom with
   * no nesting, which is the point — the previous version wrapped half the
   * handler in `if (userByEmail)`, so an email with no account silently skipped
   * the lockout entirely.
   *
   * Order matters. The lock is checked before any password work, so a locked
   * account costs one indexed lookup rather than a full Argon2 verification.
   */
  async login(
    email: string,
    password: string,
    userAgent?: string,
    ip?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<User, "passwordHash">;
  }> {
    const user = await this.usersService.findByEmail(email);

    if (await this.bruteForceService.isLocked(email)) {
      throw new UnauthorizedException(
        "Account temporarily locked due to too many failed attempts",
      );
    }

    // Constant-cost verification. A missing account would otherwise return in
    // ~1ms while a real one spent ~60ms in Argon2, and that gap is a reliable
    // oracle for enumerating which addresses have accounts. Verifying against a
    // fixed dummy hash makes both branches cost exactly one KDF.
    const valid = await this.hashService.verifyPassword(
      user?.passwordHash ?? AuthService.DUMMY_HASH,
      password,
    );

    if (!user || !valid) {
      await this.bruteForceService.recordFailedAttempt(email, user?.id);
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.bruteForceService.resetAttempts(email);
    const tokens = await this.generateTokenPair(user, userAgent, ip);

    return { ...tokens, user: this.sanitizeUser(user) };
  }

  async refreshAccessToken(
    userId: string,
    refreshToken: string,
    userAgent?: string,
    ip?: string,
  ) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException("User not found");

    // The single authority on whether this token has been spent. One atomic
    // DELETE ... RETURNING, so of any two concurrent requests exactly one gets
    // a row back and the other gets null.
    //
    // A null result means this token was already used — i.e. it was copied.
    // Per the OAuth 2.0 Security BCP the correct response is to treat the whole
    // account as compromised and drop every session, not just the one involved.
    // Previously this threw a generic error and left the attacker's other
    // sessions alive, so a stolen refresh token bought an independent 7-day
    // session that the victim's own logout could not see.
    const consumed = await this.sessionService.consumeSessionByTokenHash(
      this.tokenHashService.hash(refreshToken),
      userId,
    );

    if (!consumed) {
      await this.sessionService.revokeAllSessions(userId);
      throw new UnauthorizedException(
        "Refresh token reuse detected — all sessions have been revoked. Please sign in again.",
      );
    }

    const tokens = await this.generateTokenPair(user, userAgent, ip);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Revokes the session matching a refresh token, if one exists.
   *
   * Deliberately does not throw when nothing is found. The controller clears
   * the cookie before calling this and returns 204 regardless, because "logged
   * out" is a client-state outcome, not a server lookup that can fail. Throwing
   * here used to skip the cookie clear entirely and leave the client stuck.
   */
  async logout(userId: string, sessionToken?: string): Promise<void> {
    if (!sessionToken) return;

    const tokenHash = this.tokenHashService.hash(sessionToken);
    const session = await this.sessionService.findByRefreshTokenHash(tokenHash);
    if (!session) return;

    await this.sessionService.revokeSession(session.id, userId);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (user) {
      const { rawToken } = await this.resetTokenService.create(user.id);
      const frontendUrl = this.configService.get<string>(
        "FRONTEND_URL",
        "http://localhost:3000",
      );
      // Derive the displayed lifetime from the configured one. The template
      // used to be handed a hardcoded "1", which silently lied to the user
      // whenever RESET_TOKEN_EXPIRATION_MS was set to anything else.
      //
      // The variable is named _MS but `.env.example` documents it as a
      // duration string ("1h"), so `ms()` parses both forms. A value that
      // fails to parse yields NaN, hence the Number.isFinite guard: the reset
      // must still go out rather than 500 on an unparseable TTL.
      const resetTtlMs = ms(
        (this.configService.get<string>("RESET_TOKEN_EXPIRATION_MS") ??
          "1h") as StringValue,
      );
      const expiresInHours = Number.isFinite(resetTtlMs)
        ? Math.max(1, Math.round(resetTtlMs / 3_600_000))
        : 1;

      await this.emailService.sendPasswordReset({
        to: user.email,
        resetUrl: `${frontendUrl}/reset-password?token=${rawToken}`,
        expiresInHours,
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
    // Everything runs in one transaction and the token is claimed FIRST.
    //
    // Two separate defects are fixed here:
    //
    // 1. Non-atomic spend. validate() → update password → markUsed() left a
    //    window where the token still read `usedAt IS NULL`. Fifty concurrent
    //    requests with one token all passed the check and all set a password;
    //    the last writer won and the token then looked properly used. The
    //    conditional UPDATE claims it atomically, so exactly one caller wins.
    //
    // 2. Sessions survived the reset. An attacker who had already obtained a
    //    session kept it after the user changed their password, so the user's
    //    recovery did not actually evict them — the account stayed silently
    //    compromised while the user believed they had fixed it. Every session is
    //    revoked inside the same transaction.
    await this.dataSource.transaction(async (manager) => {
      const claimed = await this.resetTokenService.claim(token, manager);
      if (!claimed) {
        throw new BadRequestException("Invalid or expired reset token");
      }

      const resetToken = await this.resetTokenService.findByToken(token);
      if (!resetToken?.user) {
        throw new BadRequestException("Invalid or expired reset token");
      }

      const passwordHash = await this.hashService.hashPassword(newPassword);
      await manager.update(User, { id: resetToken.user.id }, { passwordHash });
      await manager.delete(Session, { user: { id: resetToken.user.id } });
    });

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

    // Derived from the same duration string that signs the refresh token, so the
    // session row and the token itself cannot disagree about expiry. These used
    // to be two independent config values.
    const expiresAt = new Date(Date.now() + this.refreshDurationMs);

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
    // `role` is an authorization claim, not PII. It stays in the token because
    // a JWT is signed rather than encrypted — anyone holding it can already
    // base64-decode every claim — so keeping it discloses nothing, and it saves
    // a database round trip on every guarded request. `email` is genuine PII
    // and stays out.
    //
    // Removing it without teaching JwtStrategy to reload the user left
    // `user.role` undefined on every request, which made RolesGuard reject
    // everyone and BasePolicy.isAdmin() silently return false everywhere.
    return this.jwtService.sign({ sub: user.id, role: user.role });
  }

  private generateRefreshToken(user: User): string {
    return this.jwtService.sign(
      { sub: user.id, jti: randomUUID() },
      {
        secret: this.configService.get<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.refreshDuration,
      },
    );
  }

  private sanitizeUser(user: User): Omit<User, "passwordHash"> {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
