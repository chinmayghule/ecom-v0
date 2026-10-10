import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMAIL_SERVICE,
  EmailModule,
  selectEmailTransport,
} from "../email.module.js";
import { ResendEmailService } from "../resend-email.service.js";

const resendSend = vi.fn().mockResolvedValue(undefined);

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

/**
 * Transport selection.
 *
 * This factory is where the production bug lived: it chose on NODE_ENV alone,
 * so a deploy without RESEND_API_KEY received a ResendEmailService whose client
 * was never constructed, and forgot-password failed with
 * `Cannot read properties of undefined (reading 'emails')` — on the only route
 * by which a locked-out user recovers their account.
 *
 * It is a factory function whose branches are invisible to a test that only
 * exercises DevEmailService, which is why it sat at zero coverage.
 */
describe("selectEmailTransport", () => {
  const resend = { name: "resend" } as unknown as EmailService;
  const smtp = { name: "smtp" } as unknown as EmailService;
  const dev = { name: "dev" } as unknown as EmailService;

  const config = (values: Record<string, string | undefined>) =>
    ({ get: (key: string) => values[key] }) as unknown as ConfigService;

  const pick = (values: Record<string, string | undefined>) =>
    selectEmailTransport(config(values), resend, smtp, dev);

  describe("defaults by environment", () => {
    it("uses SMTP in development, so resets land in Mailpit", () => {
      expect(pick({ NODE_ENV: "development" })).toBe(smtp);
    });
    it("uses Resend in production when an API key is present", () => {
      expect(
        pick({ NODE_ENV: "production", RESEND_API_KEY: "re_live_x" }),
      ).toBe(resend);
    });
    it("uses the console transport in test", () => {
      expect(pick({ NODE_ENV: "test" })).toBe(dev);
    });
    it("uses the console transport when NODE_ENV is unset", () => {
      expect(pick({})).toBe(dev);
    });
  });

  describe("production without a usable Resend key", () => {
    // Better than handing out a ResendEmailService with an undefined client:
    // onModuleInit throws in that case, so the operator sees the missing key at
    // startup instead of getting a 500 from the first password reset.
    it("falls back to console when the key is absent", () => {
      expect(pick({ NODE_ENV: "production" })).toBe(dev);
    });
    it("treats an empty key as missing", () => {
      expect(pick({ NODE_ENV: "production", RESEND_API_KEY: "" })).toBe(dev);
    });
  });

  describe("explicit EMAIL_TRANSPORT", () => {
    it("overrides the environment default", () => {
      expect(pick({ NODE_ENV: "production", EMAIL_TRANSPORT: "console" })).toBe(
        dev,
      );
      expect(pick({ NODE_ENV: "test", EMAIL_TRANSPORT: "smtp" })).toBe(smtp);
    });

    it("still requires a Resend key when resend is requested explicitly", () => {
      expect(pick({ NODE_ENV: "development", EMAIL_TRANSPORT: "resend" })).toBe(
        dev,
      );
      expect(
        pick({
          NODE_ENV: "development",
          EMAIL_TRANSPORT: "resend",
          RESEND_API_KEY: "re_x",
        }),
      ).toBe(resend);
    });

    // Silently falling back would mean "console" in production, so nobody would
    // see a reset email leave the box. A typo must be loud.
    it("rejects an unknown transport instead of falling back", () => {
      expect(() => pick({ EMAIL_TRANSPORT: "mailpit" })).toThrow(
        /EMAIL_TRANSPORT must be one of console, smtp, resend/,
      );
    });
  });
});

describe("ResendEmailService lifecycle", () => {
  async function build(config: Record<string, string | undefined>) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ResendEmailService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => config[key] },
        },
      ],
    }).compile();
    return moduleRef.get(ResendEmailService);
  }

  beforeEach(() => vi.clearAllMocks());

  it("refuses to start in production without an API key", async () => {
    const service = await build({ NODE_ENV: "production" });
    expect(() => service.onModuleInit()).toThrow(
      /RESEND_API_KEY is required in production/,
    );
  });

  it("only warns outside production", async () => {
    const service = await build({ NODE_ENV: "development" });
    expect(() => service.onModuleInit()).not.toThrow();
  });
});

describe("EmailModule.forRoot", () => {
  /**
   * Compiles the module for real rather than stubbing the factory.
   *
   * The selection logic has its own tests above; what they cannot catch is a
   * provider that is listed but not resolvable — a mis-declared `inject`, or a
   * transport added to the factory without being provided. That fails at boot
   * and nowhere else, which is the same class of defect as the original bug:
   * correct in isolation, wrong when assembled.
   */
  it("resolves EMAIL_SERVICE with every provider wired", async () => {
    const module = await Test.createTestingModule({
      imports: [EmailModule.forRoot()],
    }).compile();
    const service = module.get<EmailService>(EMAIL_SERVICE);
    expect(service).toBeDefined();
    expect(typeof service.send).toBe("function");
    expect(typeof service.sendPasswordReset).toBe("function");
    await module.close();
  });

  it("selects the transport the configuration names", async () => {
    const previous = process.env.EMAIL_TRANSPORT;
    try {
      process.env.EMAIL_TRANSPORT = "smtp";
      const module = await Test.createTestingModule({
        imports: [EmailModule.forRoot()],
      }).compile();
      expect(module.get<EmailService>(EMAIL_SERVICE).constructor.name).toBe(
        "SmtpEmailService",
      );
      await module.close();

      process.env.EMAIL_TRANSPORT = "console";
      const other = await Test.createTestingModule({
        imports: [EmailModule.forRoot()],
      }).compile();
      expect(other.get<EmailService>(EMAIL_SERVICE).constructor.name).toBe(
        "DevEmailService",
      );
      await other.close();
    } finally {
      if (previous === undefined) delete process.env.EMAIL_TRANSPORT;
      else process.env.EMAIL_TRANSPORT = previous;
    }
  });
});
