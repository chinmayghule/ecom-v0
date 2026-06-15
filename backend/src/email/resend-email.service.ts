import type { OnModuleInit } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import type {
  EmailOptions,
  EmailService,
} from "./interfaces/email-service.interface.js";

@Injectable()
export class ResendEmailService implements EmailService, OnModuleInit {
  private readonly logger = new Logger(ResendEmailService.name);
  private client!: Resend;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>("RESEND_API_KEY") ?? "";
    this.client = new Resend(apiKey);
    if (!apiKey) {
      this.logger.error(
        "RESEND_API_KEY is not set — email sending will fail in production",
      );
    }
  }

  async send(options: EmailOptions): Promise<void> {
    const from = this.configService.get<string>(
      "RESEND_FROM_EMAIL",
      "noreply@example.com",
    );
    await this.client.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }
}
