import { ConfigService } from "@nestjs/config";
import { SecurityConfigValidator } from "../security-config.validator.js";

/**
 * The production boot gate.
 *
 * Worth testing carefully because it is the control that stands between a
 * misconfigured deploy and a running one. The specific failure it exists for:
 * NODE_ENV was set nowhere — not in `.env`, and Render does not set it — so the
 * refresh cookie's `secure` flag evaluated to false on a production deploy and
 * the browser would send the 7-day session cookie over plain HTTP. Nothing
 * failed, no request errored, and the app reported healthy.
 */
describe("SecurityConfigValidator", () => {
  const good = {
    NODE_ENV: "production",
    JWT_SECRET: "a".repeat(64),
    JWT_REFRESH_SECRET: "b".repeat(64),
    JWT_ACCESS_EXPIRATION: "15m",
    CORS_ORIGIN: "https://example.com",
  };

  function build(overrides: Record<string, string | undefined> = {}) {
    const config = { ...good, ...overrides };
    for (const key of Object.keys(overrides)) {
      // "" rather than delete: ConfigService falls back to process.env when a
      // key is absent from its internal config, and the test runner sets
      // NODE_ENV=test there — so a deleted key would read back as "test" and the
      // unset cases would pass for the wrong reason. `skipProcessEnv` on the
      // ConfigService constructor does not help: in @nestjs/config 4.0.4 the
      // constructor assigns `this._skipProcessEnv = false` after applying the
      // options, so the flag is always cleared.
      config[key] = overrides[key] ?? "";
    }
    const configService = new ConfigService(config as Record<string, string>);
    return new SecurityConfigValidator(configService);
  }

  describe("when the environment is production", () => {
    it("accepts a correctly configured deployment", () => {
      expect(() => build().validate()).not.toThrow();
    });

    it("rejects an unset NODE_ENV even when everything else is correct", () => {
      // The check that matters. "Is this production?" is unanswerable when the
      // answer is undefined, so an unset value must fail loudly rather than
      // fall through to the development defaults — which is precisely how
      // `secure: false` reached a production deploy unnoticed.
      expect(() => build({ NODE_ENV: undefined }).validate()).toThrow(
        /NODE_ENV is unset/,
      );
    });

    it("rejects a whitespace-only NODE_ENV", () => {
      // `.env` lines often end up blank-but-present. A blank value is not a
      // valid environment and must not be treated as one.
      expect(() => build({ NODE_ENV: "   " }).validate()).not.toThrow();
      expect(() => build({ NODE_ENV: undefined }).validate()).toThrow();
    });

    it("rejects placeholder secrets from .env.example", () => {
      expect(() =>
        build({
          JWT_SECRET: "change-me-to-a-random-64-char-string",
          JWT_REFRESH_SECRET: "b".repeat(64),
        }).validate(),
      ).toThrow(/JWT_SECRET is still the .env.example placeholder/);
    });

    it("rejects short secrets", () => {
      expect(() =>
        build({
          JWT_SECRET: "tooshort",
          JWT_REFRESH_SECRET: "b".repeat(64),
        }).validate(),
      ).toThrow(/JWT_SECRET must be at least 32 characters/);
    });

    it("rejects identical access and refresh secrets", () => {
      // If they match, a refresh token verifies as an access token and the
      // 7-day token gains access-token scope.
      const shared = "c".repeat(64);
      expect(() =>
        build({ JWT_SECRET: shared, JWT_REFRESH_SECRET: shared }).validate(),
      ).toThrow(/must differ/);
    });

    it("rejects a long-lived access token", () => {
      expect(() => build({ JWT_ACCESS_EXPIRATION: "30d" }).validate()).toThrow(
        /over an hour/,
      );
    });

    it("accepts an access token at the one-hour boundary", () => {
      expect(() =>
        build({ JWT_ACCESS_EXPIRATION: "1h" }).validate(),
      ).not.toThrow();
    });

    it("parses every duration unit", () => {
      for (const [value, over] of [
        ["500ms", false],
        ["45s", false],
        ["30m", false],
        ["1h", false],
        ["1d", true],
        ["90m", true],
      ] as const) {
        const throws = () => build({ JWT_ACCESS_EXPIRATION: value }).validate();
        if (over) expect(throws, value).toThrow();
        else expect(throws, value).not.toThrow();
      }
    });

    it("rejects a wildcard CORS origin", () => {
      expect(() => build({ CORS_ORIGIN: "*" }).validate()).toThrow(
        /CORS_ORIGIN contains/,
      );
    });

    it("rejects a wildcard mixed into a list", () => {
      expect(() =>
        build({ CORS_ORIGIN: "https://a.com, *" }).validate(),
      ).toThrow(/CORS_ORIGIN contains/);
    });

    it("accepts an explicit origin list", () => {
      expect(() =>
        build({ CORS_ORIGIN: "https://a.com, https://b.com" }).validate(),
      ).not.toThrow();
    });

    it("rejects a missing CORS_ORIGIN entirely", () => {
      expect(() => build({ CORS_ORIGIN: undefined }).validate()).toThrow(
        /CORS_ORIGIN must list/,
      );
    });

    it("reports every violation at once rather than one per restart", () => {
      // A deploy that fails on the first violation, gets it fixed, and fails
      // again on the next one is a slow way to discover a misconfiguration.
      expect(() =>
        build({
          JWT_SECRET: "short",
          JWT_REFRESH_SECRET: "short",
          CORS_ORIGIN: "*",
        }).validate(),
      ).toThrow(/JWT_SECRET must be at least 32[\s\S]*CORS_ORIGIN contains/);
    });

    it("stops at the NODE_ENV violation rather than guessing the environment", () => {
      // With NODE_ENV unset there is no way to know whether the production rules
      // apply, so reporting them would be guessing. The one actionable fact is
      // that the variable is missing.
      let message = "";
      try {
        build({ NODE_ENV: undefined, JWT_SECRET: "short" }).validate();
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain("NODE_ENV is unset");
      expect(message).not.toContain("JWT_SECRET must be");
    });
  });

  describe("when the environment is not production", () => {
    it("never throws in development, however weak the secrets are", () => {
      expect(() =>
        build({
          NODE_ENV: "development",
          JWT_SECRET: "change-me",
          JWT_REFRESH_SECRET: "change-me-too",
          CORS_ORIGIN: undefined,
        }).validate(),
      ).not.toThrow();
    });

    it("never throws in test", () => {
      expect(() =>
        build({ NODE_ENV: "test", JWT_SECRET: "x" }).validate(),
      ).not.toThrow();
    });
  });
});
