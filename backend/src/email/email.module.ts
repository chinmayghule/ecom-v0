import { type DynamicModule, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { DevEmailService } from "./dev-email.service.js";
import type { EmailService } from "./interfaces/email-service.interface.js";
import { ResendEmailService } from "./resend-email.service.js";
import { SmtpEmailService } from "./smtp-email.service.js";

export const EMAIL_SERVICE = "EMAIL_SERVICE";

/** The transports `EMAIL_TRANSPORT` can name. */
export const EMAIL_TRANSPORTS = ["console", "smtp", "resend"] as const;
export type EmailTransport = (typeof EMAIL_TRANSPORTS)[number];

/**
 * Resolves which transport to use.
 *
 * Defaults are deliberately different per environment:
 *
 * - production → `resend`, and a missing API key is fatal (see below)
 * - development → `smtp`, so a reset link lands in Mailpit where it can be
 *   clicked rather than being copied out of a log line
 * - anything else (test, CI) → `console`, which cannot fail
 *
 * The fallback when production has no key is `console` rather than a Resend
 * service with an undefined client. That was the original defect: selecting
 * Resend regardless of configuration meant the first forgot-password failed
 * with `Cannot read properties of undefined (reading 'emails')` — a 500 on the
 * only route by which a locked-out user recovers their account.
 * `ResendEmailService.onModuleInit` now throws in that case, so the deploy
 * refuses to start instead.
 *
 * Exported as a pure function so the decision is directly testable. It was
 * inlined in a `useFactory`, where it sat at zero coverage: the only test that
 * existed exercised `DevEmailService` in isolation and never asked which
 * transport had been selected.
 */
export function selectEmailTransport(
  config: Pick<ConfigService, "get">,
  resend: EmailService,
  smtp: EmailService,
  dev: EmailService,
): EmailService {
  const nodeEnv = config.get<string>("NODE_ENV");
  const configured = config.get<string>("EMAIL_TRANSPORT");

  // An unrecognised value is a typo, and silently falling back would hide it —
  // in production that means "console", so nobody would see a reset email
  // leave the box.
  if (
    configured !== undefined &&
    !EMAIL_TRANSPORTS.includes(configured as EmailTransport)
  ) {
    throw new Error(
      `EMAIL_TRANSPORT must be one of ${EMAIL_TRANSPORTS.join(", ")}; got "${configured}".`,
    );
  }

  const transport: EmailTransport =
    (configured as EmailTransport | undefined) ??
    (nodeEnv === "production"
      ? "resend"
      : nodeEnv === "development"
        ? "smtp"
        : "console");

  if (transport === "resend") {
    if (!config.get<string>("RESEND_API_KEY")) {
      // See the note above: better a loud startup failure than a silent 500 on
      // account recovery.
      return dev;
    }
    return resend;
  }
  if (transport === "smtp") return smtp;
  return dev;
}

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module pattern requires class
export class EmailModule {
  static forRoot(): DynamicModule {
    return {
      module: EmailModule,
      // Declared rather than assumed. `AppModule` registers `ConfigModule` with
      // `isGlobal: true`, so this import looked redundant — and then the
      // module failed to compile anywhere that was not AppModule, with
      // "Nest can't resolve dependencies of the ResendEmailService (?)". A
      // module that reads configuration should import it; relying on a global
      // makes the unit untestable in isolation and breaks the first time it is
      // reused.
      imports: [ConfigModule],
      providers: [
        ResendEmailService,
        SmtpEmailService,
        DevEmailService,
        {
          provide: EMAIL_SERVICE,
          useFactory: (
            configService: ConfigService,
            resend: ResendEmailService,
            smtp: SmtpEmailService,
            dev: DevEmailService,
          ) => selectEmailTransport(configService, resend, smtp, dev),
          inject: [
            ConfigService,
            ResendEmailService,
            SmtpEmailService,
            DevEmailService,
          ],
        },
      ],
      exports: [EMAIL_SERVICE],
    };
  }
}
