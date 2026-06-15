import path from "node:path";
import { Module, RequestMethod } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "./auth/auth.module.js";
import { ResetToken } from "./auth/entities/reset-token.entity.js";
import { validate } from "./config/env.validation.js";
import { EmailModule } from "./email/email.module.js";
import {
  Address,
  Cart,
  CartItem,
  Category,
  Inventory,
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
          Order,
          OrderItem,
          ResetToken,
        ],
        synchronize: false,
        migrationsRun: config.get<string>("NODE_ENV") === "test",
        migrations: [`${process.cwd()}/src/migrations/*.{ts,js}`],
        logging: config.get<string>("NODE_ENV") !== "test",
      }),
      inject: [ConfigService],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        name: "ecom-v0",
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
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    EmailModule.forRoot(),
    HealthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
