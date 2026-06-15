import { Injectable, Logger } from "@nestjs/common";
import type {
  EmailOptions,
  EmailService,
} from "./interfaces/email-service.interface.js";

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
}
