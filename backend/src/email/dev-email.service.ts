import { Injectable, Logger } from "@nestjs/common";
import type {
  EmailOptions,
  EmailService,
  PasswordResetEmail,
} from "./interfaces/email-service.interface.js";

/**
 * Development transport: writes the message to the console, sends nothing.
 *
 * This is the implementation active whenever NODE_ENV is not "production"
 * (see `EmailModule.forRoot`). No filesystem access, no network — a reset
 * request during local development cannot fail for reasons unrelated to the
 * request itself.
 */
@Injectable()
export class DevEmailService implements EmailService {
  private readonly logger = new Logger(DevEmailService.name);

  async send(options: EmailOptions): Promise<void> {
    this.logger.log("--- Dev Email ---");
    this.logger.log(`To: ${options.to}`);
    this.logger.log(`Subject: ${options.subject}`);
    this.logger.log(`Body: ${options.html}`);
    this.logger.log("--- End Dev Email ---");
  }

  /**
   * The URL is printed bare and on its own line so it stays clickable in a
   * terminal and can be copy-pasted straight into a browser. Rendering HTML
   * here would emit escaped entities and angle brackets, which makes the one
   * thing a developer needs from this message harder to read.
   */
  async sendPasswordReset(email: PasswordResetEmail): Promise<void> {
    this.logger.log("--- Dev Password Reset ---");
    this.logger.log(`To: ${email.to}`);
    this.logger.log(`Expires in: ${email.expiresInHours} hour(s)`);
    this.logger.log(`Reset URL: ${email.resetUrl}`);
    this.logger.log("--- End Dev Password Reset ---");
  }
}
