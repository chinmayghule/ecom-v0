import { ConfigService } from "@nestjs/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SmtpEmailService } from "../smtp-email.service.js";
import { renderPasswordReset, renderTemplate } from "../template.renderer.js";

const createTransport = vi.fn();
vi.mock("nodemailer", () => ({
  default: {
    createTransport: (...args: unknown[]) => createTransport(...args),
  },
}));

const sendMail = vi.fn().mockResolvedValue({ messageId: "1" });
const configWith = (values: Record<string, string | undefined>) =>
  ({ get: (k: string) => values[k] }) as unknown as ConfigService;

describe("SmtpEmailService", () => {
  let service: SmtpEmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    createTransport.mockReturnValue({ sendMail });
    service = new SmtpEmailService(configWith({}));
    service.onModuleInit();
  });

  it("targets Mailpit's default host and port", () => {
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "localhost", port: 1025 }),
    );
  });

  it("uses SMTP_HOST and SMTP_PORT when set", () => {
    createTransport.mockClear();
    const svc = new SmtpEmailService(
      configWith({ SMTP_HOST: "mailpit", SMTP_PORT: "2525" }),
    );
    svc.onModuleInit();
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "mailpit", port: 2525 }),
    );
  });

  it("passes credentials only when both user and password are present", () => {
    createTransport.mockClear();
    new SmtpEmailService(
      configWith({ SMTP_HOST: "mailpit", SMTP_USER: "u" }),
    ).onModuleInit();
    expect(
      (createTransport.mock.calls[0][0] as { auth?: unknown }).auth,
    ).toBeUndefined();

    createTransport.mockClear();
    new SmtpEmailService(
      configWith({ SMTP_USER: "u", SMTP_PASSWORD: "p" }),
    ).onModuleInit();
    expect(createTransport.mock.calls[0][0]).toMatchObject({
      auth: { user: "u", pass: "p" },
    });
  });

  it("enables TLS when SMTP_SECURE is true", () => {
    createTransport.mockClear();
    new SmtpEmailService(configWith({ SMTP_SECURE: "true" })).onModuleInit();
    expect(createTransport.mock.calls[0][0]).toMatchObject({
      secure: true,
      ignoreTLS: false,
    });
  });

  it("sends a password reset with the rendered template", async () => {
    await service.sendPasswordReset({
      to: "user@example.com",
      resetUrl: "http://localhost:3000/reset?token=abc",
      expiresInHours: 1,
    });
    expect(sendMail).toHaveBeenCalledOnce();
    const msg = sendMail.mock.calls[0][0] as Record<string, string>;
    expect(msg.to).toBe("user@example.com");
    expect(msg.subject).toBe("Password Reset - Ecom");
    expect(msg.html).toContain("http://localhost:3000/reset?token=abc");
    expect(msg.html).not.toContain("{{");
  });

  it("prefers EMAIL_FROM over RESEND_FROM_EMAIL", async () => {
    const svc = new SmtpEmailService(
      configWith({ EMAIL_FROM: "a@x.com", RESEND_FROM_EMAIL: "b@x.com" }),
    );
    svc.onModuleInit();
    await svc.send({ to: "u@x.com", subject: "s", html: "<p>h</p>" });
    expect((sendMail.mock.calls[0][0] as { from: string }).from).toBe(
      "a@x.com",
    );
  });
});

describe("renderTemplate", () => {
  it("substitutes known placeholders", () => {
    const html = renderPasswordReset("http://x/reset?t=1", 2);
    expect(html).toContain("http://x/reset?t=1");
    expect(html).not.toContain("{{");
  });

  // A reset token is base64url and can contain `$&`; with a string pattern
  // `String.replace` would expand it as a capture-group reference and corrupt
  // the only link the email carries.
  it("inserts values literally, without expand-pattern expansion", () => {
    const tricky = "http://x/reset?token=$&$1$`$'";
    const html = renderPasswordReset(tricky, 1);
    expect(html).toContain(tricky);
  });

  it("leaves unknown placeholders untouched rather than blanking them", () => {
    const out = renderTemplate("password-reset", {});
    expect(out).toContain("{{RESET_URL}}");
  });
});
