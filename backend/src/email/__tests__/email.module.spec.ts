import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectEmailTransport } from "../email.module.js";
import type { EmailService } from "../interfaces/email-service.interface.js";
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
  const dev = { name: "dev" } as unknown as EmailService;

  const config = (values: Record<string, string | undefined>) =>
    ({ get: (key: string) => values[key] }) as unknown as ConfigService;

  it("uses the console transport in development", () => {
    expect(
      selectEmailTransport(config({ NODE_ENV: "development" }), resend, dev),
    ).toBe(dev);
  });

  it("uses Resend in production when an API key is present", () => {
    expect(
      selectEmailTransport(
        config({ NODE_ENV: "production", RESEND_API_KEY: "re_live_x" }),
        resend,
        dev,
      ),
    ).toBe(resend);
  });

  it("falls back to the console transport when production has no API key", () => {
    // Better than handing out a ResendEmailService with an undefined client:
    // onModuleInit throws in that case, so the operator sees the missing key at
    // startup instead of getting a 500 from the first password reset.
    expect(
      selectEmailTransport(config({ NODE_ENV: "production" }), resend, dev),
    ).toBe(dev);
  });

  it("treats an empty API key as missing", () => {
    expect(
      selectEmailTransport(
        config({ NODE_ENV: "production", RESEND_API_KEY: "" }),
        resend,
        dev,
      ),
    ).toBe(dev);
  });

  it("uses the console transport when NODE_ENV is unset", () => {
    expect(selectEmailTransport(config({}), resend, dev)).toBe(dev);
  });

  it("uses the console transport in test", () => {
    expect(
      selectEmailTransport(config({ NODE_ENV: "test" }), resend, dev),
    ).toBe(dev);
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
