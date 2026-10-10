import type { OnModuleInit } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import type {
  EmailOptions,
  EmailService,
  PasswordResetEmail,
} from "./interfaces/email-service.interface.js";
import { renderPasswordReset } from "./template.renderer.js";

/**
 * Production transport: renders the HTML template and hands it to Resend.
 *
 * This class owns the template directory. `AuthService` used to own it, which
 * put a `readFileSync` in the middle of a business flow — a missing or
 * unreadable template surfaced as a 500 from `forgotPassword`, on a code path
 * whose only failure mode should be "no such user". Filesystem knowledge now
 * stops at the transport boundary, where the concern actually belongs.
 */
@Injectable()
export class ResendEmailService implements EmailService, OnModuleInit {
  private readonly logger = new Logger(ResendEmailService.name);
  private client!: Resend;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>("RESEND_API_KEY") ?? "";
    if (!apiKey) {
      // Previously this warned and returned, leaving `client` undefined while
      // EmailModule still handed this instance to anything that injected
      // EMAIL_SERVICE — because selection is keyed on NODE_ENV alone. In
      // production the first forgot-password then failed with
      // `Cannot read properties of undefined (reading 'emails')`, a 500 on the
      // account-recovery path. A warning nobody reads is not a control; failing
      // at startup puts the misconfiguration somewhere it can actually be seen.
      if (this.configService.get<string>("NODE_ENV") === "production") {
        throw new Error(
          "RESEND_API_KEY is required in production: forgot-password is the " +
            "only route by which a locked-out user recovers their account.",
        );
      }
      this.logger.warn(
        "RESEND_API_KEY is not set — DevEmailService will be used instead",
      );
      return;
    }
    this.client = new Resend(apiKey);
  }

  async send(options: EmailOptions): Promise<void> {
    await this.client.emails.send({
      from: this.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }

  async sendPasswordReset(email: PasswordResetEmail): Promise<void> {
    await this.client.emails.send({
      from: this.from,
      to: email.to,
      subject: "Password Reset - Ecom",
      html: renderPasswordReset(email.resetUrl, email.expiresInHours),
    });
  }

  private get from(): string {
    return (
      this.configService.get<string>("RESEND_FROM_EMAIL") ??
      "noreply@example.com"
    );
  }
}
