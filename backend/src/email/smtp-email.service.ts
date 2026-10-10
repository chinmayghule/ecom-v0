import type { OnModuleInit } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";
import type {
  EmailOptions,
  EmailService,
  PasswordResetEmail,
} from "./interfaces/email-service.interface.js";
import { renderPasswordReset } from "./template.renderer.js";

/**
 * SMTP transport, for local development and self-hosted mail.
 *
 * Points at Mailpit in development (`docker compose up mailpit`) so a password
 * reset can be read in a browser at http://localhost:8025 instead of being
 * scraped out of a log line. Mailpit captures everything in memory and never
 * delivers, which is why this is safe to enable by default in dev.
 *
 * Nodemailer connections are lazy — the transport is created here but no socket
 * opens until the first `send`. That is deliberate: if Mailpit is not running
 * the first send fails and `forgotPassword` surfaces it, rather than the app
 * refusing to boot over a service the user may not have started.
 */
@Injectable()
export class SmtpEmailService implements EmailService, OnModuleInit {
  private readonly logger = new Logger(SmtpEmailService.name);
  private transporter!: Transporter;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const port = Number(this.configService.get("SMTP_PORT") ?? 1025);
    const host = this.configService.get<string>("SMTP_HOST") ?? "localhost";
    const user = this.configService.get<string>("SMTP_USER");
    const pass = this.configService.get<string>("SMTP_PASSWORD");

    this.transporter = nodemailer.createTransport({
      host,
      port,
      // Mailpit speaks plain SMTP on 1025 with no credentials. `secure` is the
      // TLS flag; leaving it unset means opportunistic TLS, which is right for
      // a local relay and wrong for a real one, so it is configurable.
      secure: this.configService.get("SMTP_SECURE") === "true",
      ignoreTLS: this.configService.get("SMTP_SECURE") !== "true",
      auth: user && pass ? { user, pass } : undefined,
    });

    this.logger.log(`SMTP transport ready — ${host}:${port} (no delivery)`);
  }

  async send(options: EmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }

  async sendPasswordReset(email: PasswordResetEmail): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email.to,
      subject: "Password Reset - Ecom",
      html: renderPasswordReset(email.resetUrl, email.expiresInHours),
    });
  }

  private get from(): string {
    return (
      this.configService.get<string>("EMAIL_FROM") ??
      this.configService.get<string>("RESEND_FROM_EMAIL") ??
      "noreply@example.com"
    );
  }
}
