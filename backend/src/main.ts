import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common/pipes/validation.pipe.js";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { SecurityConfigValidator } from "./config/security-config.validator.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Refuse to start a production deploy that is missing a security control.
  // Runs after the DI container is built but before the port is opened, so a
  // bad configuration never accepts a single request. Throws with the full list
  // of violations.
  app.get(SecurityConfigValidator).validate();

  // security headers
  app.use(helmet());

  // cookie-parser for reading httpOnly refresh token cookies
  app.use(cookieParser());

  // pino logger — replaces NestJS default console logger
  app.useLogger(app.get(Logger));

  // CORS — origins come from configuration, never a wildcard. Read after the
  // DI container exists so .env has been loaded.
  const { ConfigService } = await import("@nestjs/config");
  const configService = app.get(ConfigService);
  const corsOrigin = configService.get<string>("CORS_ORIGIN");
  app.enableCors({
    origin: corsOrigin ? corsOrigin.split(",").map((o) => o.trim()) : false,
    credentials: true,
  });

  // global validation pipe with whitelist to strip out any properties that are not defined in the DTOs.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.BACKEND_PORT ?? 3000);
}
bootstrap();
