import path from "node:path";
import { fileURLToPath } from "node:url";
import { Module, RequestMethod } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "./auth/auth.module.js";
import { ResetToken } from "./auth/entities/reset-token.entity.js";
import { GLOBAL_RATE_LIMIT } from "./common/rate-limits.js";
import { validate } from "./config/env.validation.js";
import { SecurityConfigValidator } from "./config/security-config.validator.js";
import { EmailModule } from "./email/email.module.js";
import {
  Address,
  Cart,
  CartItem,
  Category,
  Inventory,
  LoginAttempt,
  Order,
  OrderItem,
  Product,
  SellerProfile,
  Session,
  User,
} from "./entities/index.js";
import { HealthModule } from "./health/health.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: [
        path.resolve(process.cwd(), ".env"),
        path.resolve(process.cwd(), "..", ".env"),
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.getOrThrow<string>("DATABASE_HOST"),
        port: config.getOrThrow<number>("DATABASE_PORT"),
        username: config.getOrThrow<string>("DATABASE_USER"),
        password: config.getOrThrow<string>("DATABASE_PASSWORD"),
        database: config.getOrThrow<string>("DATABASE_NAME"),
        entities: [
          User,
          Product,
          Category,
          Session,
          Address,
          SellerProfile,
          Inventory,
          Cart,
          CartItem,
          LoginAttempt,
          Order,
          OrderItem,
          ResetToken,
        ],
        synchronize: false,
        migrationsRun: config.get<string>("NODE_ENV") === "test",
        // Resolved relative to this compiled module, not process.cwd().
        //
        // cwd is wherever the process was started, so the previous
        // `${process.cwd()}/src/migrations/*` glob matched in development and
        // found nothing once only dist/ was deployed — migrations silently
        // became a no-op in production. This path tracks the file through the
        // build: src/app.module.ts -> <root>/src, dist/app.module.js -> <root>/dist.
        //
        // import.meta.url, not __dirname: the package is ESM ("type": "module"
        // and .js extensions on every relative import), and __dirname does not
        // exist there. TypeScript accepts it anyway because @types/node declares
        // it globally, so the build passes and the process dies at runtime with
        // "ReferenceError: __dirname is not defined" — caught here by starting
        // the server, not by any test.
        migrations: [
          path.join(
            path.dirname(fileURLToPath(import.meta.url)),
            "migrations",
            "*.{ts,js}",
          ),
        ],
        logging: config.get<string>("NODE_ENV") !== "test",
      }),
      inject: [ConfigService],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        name: "ecom-v0",
        // ConfigModule.forRoot() is the FIRST entry in `imports`, and the
        // object literal evaluates in order, so .env is already on
        // process.env by the time this line runs. That ordering is why this
        // file is safe and auth.controller.ts was not — the controller module
        // is imported by auth.module.ts, which is imported at the TOP of this
        // file, so its module-level const ran before forRoot() ever did.
        level: process.env.NODE_ENV === "production" ? "info" : "trace",
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
        redact: {
          paths: [
            "password",
            "token",
            "authorization",
            "cookie",
            "secret",
            "req.headers.cookie",
            "req.headers.authorization",
            "body.password",
            "body.token",
          ],
          censor: "[REDACTED]",
        },
        autoLogging: {
          ignore: (req) => req.url === "/health",
        },
      },
      exclude: [{ method: RequestMethod.ALL, path: "health" }],
    }),
    AuthModule,
    ThrottlerModule.forRoot([GLOBAL_RATE_LIMIT]),
    EmailModule.forRoot(),
    HealthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    SecurityConfigValidator,
  ],
})
export class AppModule {}
