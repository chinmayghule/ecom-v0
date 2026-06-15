import { plainToInstance } from "class-transformer";
import {
  IsNumberString,
  IsOptional,
  IsString,
  validateSync,
} from "class-validator";

class EnvironmentVariables {
  @IsString()
  DATABASE_HOST!: string;

  @IsNumberString()
  DATABASE_PORT!: string;

  @IsString()
  DATABASE_USER!: string;

  @IsString()
  DATABASE_PASSWORD!: string;

  @IsString()
  DATABASE_NAME!: string;

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_EXPIRATION_MS?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_EXPIRATION_MS?: string;

  @IsOptional()
  @IsString()
  FRONTEND_URL?: string;

  @IsOptional()
  @IsString()
  RESEND_API_KEY?: string;

  @IsOptional()
  @IsString()
  RESEND_FROM_EMAIL?: string;

  @IsOptional()
  @IsString()
  NODE_ENV?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map(
        (err) =>
          `${err.property}: ${Object.values(err.constraints ?? {}).join(", ")}`,
      )
      .join("\n");
    throw new Error(`Environment validation failed:\n${messages}`);
  }

  return validatedConfig;
}
