import { type DynamicModule, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DevEmailService } from "./dev-email.service.js";
import type { EmailService } from "./interfaces/email-service.interface.js";
import { ResendEmailService } from "./resend-email.service.js";

export const EMAIL_SERVICE = "EMAIL_SERVICE";

/**
 * Chooses which transport actually delivers mail.
 *
 * Exported as a pure function so the decision is directly testable. It was
 * previously inlined in the `useFactory` below, where it sat at zero coverage:
 * the only test that existed exercised `DevEmailService` in isolation and never
 * asked which transport had been selected.
 *
 * The fallback matters. Selecting Resend without an API key used to hand out a
 * `ResendEmailService` whose client was never constructed, so the first
 * forgot-password failed with `Cannot read properties of undefined (reading
 * 'emails')` — a 500 on the only route by which a locked-out user recovers
 * their account. `ResendEmailService.onModuleInit` now throws in that case, so
 * the deploy refuses to start rather than failing later under load.
 */
export function selectEmailTransport(
  config: Pick<ConfigService, "get">,
  resend: EmailService,
  dev: EmailService,
): EmailService {
  const isProduction = config.get<string>("NODE_ENV") === "production";
  if (isProduction && !config.get<string>("RESEND_API_KEY")) return dev;
  return isProduction ? resend : dev;
}

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module pattern requires class
export class EmailModule {
  static forRoot(): DynamicModule {
    return {
      module: EmailModule,
      providers: [
        ResendEmailService,
        DevEmailService,
        {
          provide: EMAIL_SERVICE,
          useFactory: (
            configService: ConfigService,
            resend: ResendEmailService,
            dev: DevEmailService,
          ) => selectEmailTransport(configService, resend, dev),
          inject: [ConfigService, ResendEmailService, DevEmailService],
        },
      ],
      exports: [EMAIL_SERVICE],
    };
  }
}
