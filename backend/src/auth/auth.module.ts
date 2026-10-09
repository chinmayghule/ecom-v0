import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import type { StringValue } from "ms";
import { EmailModule } from "../email/email.module.js";
import { LoginAttempt } from "../entities/login-attempt.entity.js";
import { Session } from "../entities/session.entity.js";
import { UsersModule } from "../users/users.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { BruteForceService } from "./brute-force.service.js";
import { ResetToken } from "./entities/reset-token.entity.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { PoliciesGuard } from "./guards/policies.guard.js";
import { RefreshTokenGuard } from "./guards/refresh-token.guard.js";
import { RolesGuard } from "./guards/roles.guard.js";
import { HashService } from "./hash.service.js";
import {
  CartPolicy,
  OrderPolicy,
  ProductPolicy,
  SellerProfilePolicy,
} from "./policies/index.js";
import { ResetTokenService } from "./reset-token.service.js";
import { SessionService } from "./session.service.js";
import { JwtStrategy } from "./strategies/jwt.strategy.js";
import { TokenHashService } from "./token-hash.service.js";

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          // jsonwebtoken reads a NUMBER as SECONDS and a STRING as a duration
          // parsed by ms(). This used to pass Number(...) over an _MS value, so
          // JWT_ACCESS_EXPIRATION_MS=900000 produced a 250-hour token while the
          // refresh path, passing the same shape as a string, correctly got 7
          // days. Both sides now take a duration string, so the unit is
          // unambiguous and cannot drift between the two token types again.
          expiresIn: config.get<string>(
            "JWT_ACCESS_EXPIRATION",
            "15m",
          ) as StringValue,
        },
      }),
    }),
    TypeOrmModule.forFeature([Session, ResetToken, LoginAttempt]),
    EmailModule.forRoot(),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    BruteForceService,
    SessionService,
    HashService,
    TokenHashService,
    ResetTokenService,
    JwtStrategy,
    JwtAuthGuard,
    RefreshTokenGuard,
    RolesGuard,
    PoliciesGuard,
    ProductPolicy,
    OrderPolicy,
    CartPolicy,
    SellerProfilePolicy,
  ],
  exports: [AuthService, SessionService, HashService, TokenHashService],
})
export class AuthModule {}
