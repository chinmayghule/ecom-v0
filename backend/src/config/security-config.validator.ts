import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Fails the process at boot when a production deployment is missing a security
 * control that nothing else would catch.
 *
 * Why this exists rather than a comment: the refresh cookie's `secure` flag is
 * derived from NODE_ENV, and NODE_ENV was set nowhere — not in `.env`, and
 * Render does not set it by default. So a production deploy silently ran with
 * `secure: false`, and the browser would attach the 7-day refresh cookie over
 * plain HTTP. SameSite still blocks cross-site *use*, so no CSRF token is
 * needed — but a passive network attacker can read the cookie off the wire and
 * replay it at /auth/refresh. Nothing in the request path fails, no test
 * catches it, and the app looks healthy.
 *
 * A misconfiguration that only manifests under attack should instead refuse to
 * start. Five seconds of failing loudly beats seven days of exposure.
 */
@Injectable()
export class SecurityConfigValidator {
  private readonly logger = new Logger(SecurityConfigValidator.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Never throws in development or test — those legitimately run with weaker
   * settings and placeholder secrets.
   */
  validate(): void {
    const violations = this.collectViolations();

    if (violations.length === 0) return;

    const message = [
      "Refusing to start: production security invariants are not met.",
      "",
      ...violations.map((v) => `  ✗ ${v}`),
      "",
      "These are not warnings. Each one ships a deploy that looks healthy and",
      "fails only under attack. Fix the environment and redeploy.",
    ].join("\n");

    this.logger.error(message);
    throw new Error(message);
  }

  private collectViolations(): string[] {
    const violations: string[] = [];

    // NODE_ENV must be set explicitly, in every environment.
    //
    // Not an optional check. Every control below keys off it — the cookie's
    // `secure` flag, the pino transport, whether migrations auto-run — so an
    // unset value means the app silently runs in its development defaults while
    // believing it is deployed. That was the original defect: NODE_ENV was
    // absent from `.env`, Render does not set it, and `secure` was therefore
    // false in production with nothing failing.
    //
    // Checked before the environment split, because "is it production?" is not
    // a question that can be answered when the answer is undefined.
    const nodeEnv = this.configService.get<string>("NODE_ENV");
    if (!nodeEnv) {
      violations.push(
        'NODE_ENV is unset. Set it to "development", "test" or "production". ' +
          "Every security check below reads it, and an unset value silently " +
          "falls back to the development defaults — including a refresh cookie " +
          "without the Secure flag.",
      );
      return violations;
    }

    if (nodeEnv !== "production") return violations;

    const require_: (key: string) => string | undefined = (key) =>
      this.configService.get<string>(key);

    // 1. Secrets must be real, not the placeholders shipped in .env.example.
    for (const key of ["JWT_SECRET", "JWT_REFRESH_SECRET"]) {
      const value = require_(key);
      if (!value || value.length < 32) {
        violations.push(`${key} must be at least 32 characters.`);
      }
      if (value?.toLowerCase().includes("change-me")) {
        violations.push(`${key} is still the .env.example placeholder.`);
      }
    }

    // The two tokens must not share a secret. If they do, a refresh token
    //    verifies as an access token and the 7-day token gains access-token
    //    scope.
    const access = require_("JWT_SECRET");
    const refresh = require_("JWT_REFRESH_SECRET");
    if (access && refresh && access === refresh) {
      violations.push(
        "JWT_SECRET and JWT_REFRESH_SECRET must differ — a refresh token " +
          "signed with the access secret would be accepted as an access token.",
      );
    }

    // Access tokens must be short-lived. The whole refresh-rotation design
    //    depends on the access token expiring quickly; a long-lived one widens
    //    the window after revocation.
    const accessTtl = require_("JWT_ACCESS_EXPIRATION") ?? "15m";
    if (this.durationMs(accessTtl) > 60 * 60 * 1000) {
      violations.push(
        `JWT_ACCESS_EXPIRATION is "${accessTtl}" (over an hour). Access ` +
          "tokens should be short-lived; use the refresh token for longevity.",
      );
    }

    // CORS must not be a wildcard. With a credentialed refresh cookie,
    //    `origin: *` plus credentials is rejected by browsers, but "*" leaking
    //    into a permissive list is a silent downgrade.
    const cors = this.configService.get<string>("CORS_ORIGIN");
    if (!cors) {
      violations.push("CORS_ORIGIN must list explicit allowed origins.");
    } else if (cors.split(",").some((o) => o.trim() === "*")) {
      violations.push(
        'CORS_ORIGIN contains "*". List explicit origins instead.',
      );
    }

    return violations;
  }

  private durationMs(value: string): number {
    const match = /^(\d+)\s*(ms|s|m|h|d)?$/i.exec(value.trim());
    if (!match) return Number.NaN;
    const amount = Number(match[1]);
    switch ((match[2] ?? "ms").toLowerCase()) {
      case "d":
        return amount * 86_400_000;
      case "h":
        return amount * 3_600_000;
      case "m":
        return amount * 60_000;
      case "s":
        return amount * 1000;
      default:
        return amount;
    }
  }
}
