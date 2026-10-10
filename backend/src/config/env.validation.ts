import { plainToInstance, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  validateSync,
} from "class-validator";

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_HOST!: string;

  @IsInt()
  @Type(() => Number)
  DATABASE_PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_USER!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_NAME!: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
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

  // Required, not optional. Every security-relevant default reads it — the
  // refresh cookie's Secure flag, the pino transport, whether migrations
  // auto-run. When it was left unset the app silently used its development
  // defaults on a production deploy and nothing failed. See
  // SecurityConfigValidator for the matching boot-time check.
  @IsIn(["development", "test", "production"])
  NODE_ENV!: string;

  // Duration strings ("15m", "7d"), not milliseconds. The previous _MS names
  // were passed to jsonwebtoken as a number on the access-token path, which
  // it interprets as SECONDS — so 900000 became 250 hours while the same-shaped
  // value on the refresh path, passed as a string, correctly became 7 days.
  @IsOptional()
  @Matches(/^\d+\s*(ms|s|m|h|d)$/i, {
    message: "must be a duration string such as 15m, 1h, 7d",
  })
  JWT_ACCESS_EXPIRATION?: string;

  @IsOptional()
  @Matches(/^\d+\s*(ms|s|m|h|d)$/i, {
    message: "must be a duration string such as 15m, 1h, 7d",
  })
  JWT_REFRESH_EXPIRATION?: string;

  @IsOptional()
  @Matches(/^\d+\s*(ms|s|m|h|d)$/i, {
    message: "must be a duration string such as 1h",
  })
  RESET_TOKEN_EXPIRATION_MS?: string;

  // Brute-force / lockout
  @IsOptional()
  @IsInt()
  BRUTE_FORCE_MAX_ATTEMPTS?: number;

  @IsOptional()
  @IsInt()
  BRUTE_FORCE_LOCKOUT_DURATION_MS?: number;

  @IsOptional()
  @IsInt()
  BRUTE_FORCE_WINDOW_MS?: number;

  // Rate limits, per IP. See src/common/rate-limits.ts.
  @IsOptional()
  @IsInt()
  RATE_LIMIT_GLOBAL?: number;

  @IsOptional()
  @IsInt()
  RATE_LIMIT_LOGIN?: number;

  @IsOptional()
  @IsInt()
  RATE_LIMIT_REFRESH?: number;

  @IsOptional()
  @IsInt()
  RATE_LIMIT_FORGOT?: number;

  @IsOptional()
  @IsInt()
  RATE_LIMIT_RESET?: number;

  @IsOptional()
  @IsInt()
  RATE_LIMIT_REGISTER?: number;
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
