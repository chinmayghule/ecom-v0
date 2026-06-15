import { type DynamicModule, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DevEmailService } from "./dev-email.service.js";
import { ResendEmailService } from "./resend-email.service.js";

export const EMAIL_SERVICE = "EMAIL_SERVICE";

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module pattern requires class
export class EmailModule {
  static forRoot(): DynamicModule {
    const isProduction = process.env.NODE_ENV === "production";
    return {
      module: EmailModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: EMAIL_SERVICE,
          useClass: isProduction ? ResendEmailService : DevEmailService,
        },
      ],
      exports: [EMAIL_SERVICE],
    };
  }
}
