import { ValidationPipe } from "@nestjs/common/pipes/validation.pipe.js";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import "reflect-metadata";
import { AppModule } from "./app.module.js";
import { doubleCsrfProtection } from "./auth/csrf.service.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // security headers
  app.use(helmet());

  // cookie-parser for reading httpOnly refresh token cookies
  app.use(cookieParser());

  // CSRF double-submit cookie protection for state-changing requests
  app.use(doubleCsrfProtection);

  // pino logger — replaces NestJS default console logger
  app.useLogger(app.get(Logger));

  // cors - restricted to front-end origin later.
  const corsOrigin =
    process.env.CORS_ORIGIN?.split(",") ?? "http://localhost:3000";
  app.enableCors({ origin: corsOrigin, credentials: true });

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
