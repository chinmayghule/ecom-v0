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
            const isProduction =
              configService.get<string>("NODE_ENV") === "production";
            // Selecting Resend without an API key produced a service with no
            // client, which failed at the first send rather than at startup.
            // Fall back to the console transport in that case and let
            // ResendEmailService's own onModuleInit throw, so the deploy
            // refuses to start instead of 500ing later.
            if (isProduction && !configService.get<string>("RESEND_API_KEY")) {
              return dev;
            }
            return isProduction ? resend : dev;
          },
          inject: [ConfigService, ResendEmailService, DevEmailService],
        },
      ],
      exports: [EMAIL_SERVICE],
    };
  }
}
