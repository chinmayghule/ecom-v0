import { type DynamicModule, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DevEmailService } from "./dev-email.service.js";
import { ResendEmailService } from "./resend-email.service.js";

export const EMAIL_SERVICE = "EMAIL_SERVICE";

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
          ) => {
            return configService.get<string>("NODE_ENV") === "production"
              ? resend
              : dev;
          },
          inject: [ConfigService, ResendEmailService, DevEmailService],
        },
      ],
      exports: [EMAIL_SERVICE],
    };
  }
}
