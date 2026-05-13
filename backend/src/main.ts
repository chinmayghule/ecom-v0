import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common/pipes/validation.pipe.js";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // security headers
  app.use(helmet());

  // cors - restricted to front-end origin later.
  // for now, allow all for development.
  app.enableCors({ origin: "http://localhost:3000", credentials: true });

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
