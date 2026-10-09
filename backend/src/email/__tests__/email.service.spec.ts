import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DevEmailService } from "../dev-email.service.js";
import { ResendEmailService } from "../resend-email.service.js";

// Shared across ResendEmailService instances so assertions can inspect what
// was actually handed to the API, not merely that nothing threw.
//
// `vi.mock` is hoisted above the imports, but its factory is only invoked when
// `resend` is first imported — by which point this binding is initialised. So
// the factory can close over it directly; `vi.hoisted` is not needed.
const resendSend = vi.fn().mockResolvedValue(undefined);

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: resendSend,
    };
  },
}));

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

  it("logs the password reset URL without reading a template", async () => {
    // The regression this guards: DevEmailService used to be handed pre-rendered
    // HTML, which meant AuthService had to read a template file to produce it.
    // A missing file therefore broke the dev flow, not just production.
    await expect(
      service.sendPasswordReset({
        to: "test@example.com",
        resetUrl: "http://localhost:3000/reset-password?token=abc123",
        expiresInHours: 1,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("ResendEmailService", () => {
  let service: ResendEmailService;

  beforeEach(async () => {
    resendSend.mockClear();
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
    await module.init();
    service = module.get<ResendEmailService>(ResendEmailService);
  });

  it("is defined", () => {
    expect(service).toBeDefined();
  });

  it("sends email via Resend API", async () => {
    await expect(
      service.send({
        to: "test@example.com",
        subject: "Hello",
        html: "<p>test</p>",
      }),
    ).resolves.toBeUndefined();
  });

  it("renders the password reset template into the Resend payload", async () => {
    // Exercises the real readFileSync against the real template on disk, which
    // is the part that used to live in AuthService and could throw a 500.
    await service.sendPasswordReset({
      to: "test@example.com",
      resetUrl: "http://localhost:3000/reset-password?token=abc123",
      expiresInHours: 3,
    });

    expect(resendSend).toHaveBeenCalledTimes(1);
    const payload = resendSend.mock.calls[0][0] as {
      to: string;
      subject: string;
      html: string;
    };
    expect(payload.to).toBe("test@example.com");
    expect(payload.subject).toBe("Password Reset - Ecom");
    expect(payload.html).toContain(
      'href="http://localhost:3000/reset-password?token=abc123"',
    );
    expect(payload.html).toContain("3 hour(s)");
    // No unreplaced placeholders may survive rendering.
    expect(payload.html).not.toMatch(/\{\{\w+\}\}/);
  });
});
