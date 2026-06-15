import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DevEmailService } from "../dev-email.service.js";
import { ResendEmailService } from "../resend-email.service.js";

describe("DevEmailService", () => {
  let service: DevEmailService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DevEmailService],
    }).compile();
    service = module.get<DevEmailService>(DevEmailService);
  });

  it("logs email instead of sending", async () => {
    await expect(
      service.send({
        to: "test@example.com",
        subject: "Test",
        html: "<p>test</p>",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("ResendEmailService", () => {
  let service: ResendEmailService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ResendEmailService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string, defaultValue?: string) => {
              if (key === "RESEND_API_KEY") return "test-key";
              if (key === "RESEND_FROM_EMAIL") return "test@example.com";
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();
    service = module.get<ResendEmailService>(ResendEmailService);
  });

  it("is defined", () => {
    expect(service).toBeDefined();
  });
});
