import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Rate limits are read from process.env at module load, so this suite re-imports
 * the module with `vi.resetModules()` to exercise the override and the fallbacks.
 *
 * The defaults are the production posture, so a test that silently picked up a
 * value from the developer's shell would be testing the wrong configuration.
 */
describe("rate limits", () => {
  const KEYS = [
    "RATE_LIMIT_GLOBAL",
    "RATE_LIMIT_LOGIN",
    "RATE_LIMIT_REFRESH",
    "RATE_LIMIT_FORGOT",
    "RATE_LIMIT_RESET",
    "RATE_LIMIT_REGISTER",
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  async function load() {
    vi.resetModules();
    return import("../rate-limits.js");
  }

  it("exposes a per-IP limit for every throttled route", async () => {
    const { RATE_LIMITS, GLOBAL_RATE_LIMIT } = await load();

    for (const key of [
      "login",
      "refresh",
      "forgotPassword",
      "resetPassword",
      "register",
    ]) {
      const limit = RATE_LIMITS[key as keyof typeof RATE_LIMITS];
      expect(limit.limit, key).toBeGreaterThan(0);
      expect(limit.ttl, key).toBeGreaterThan(0);
    }
    expect(GLOBAL_RATE_LIMIT.limit).toBeGreaterThan(0);
  });

  it("keeps the login limit well below the global default", async () => {
    const { RATE_LIMITS, GLOBAL_RATE_LIMIT } = await load();

    // The global limit is a backstop, not a login control. If login matched it,
    // an attacker gets the global figure against every address in a leaked list.
    expect(RATE_LIMITS.login.limit).toBeLessThan(GLOBAL_RATE_LIMIT.limit);
  });

  it("reads overrides from the environment", async () => {
    process.env.RATE_LIMIT_LOGIN = "2";
    const { RATE_LIMITS } = await load();
    expect(RATE_LIMITS.login.limit).toBe(2);
  });

  it("falls back when an override is not a positive integer", async () => {
    for (const bad of ["", "0", "-5", "abc", " "]) {
      process.env.RATE_LIMIT_LOGIN = bad;
      const { RATE_LIMITS } = await load();
      expect(RATE_LIMITS.login.limit, `input=${JSON.stringify(bad)}`).toBe(10);
    }
  });

  it("does not throw on an unparseable value", async () => {
    process.env.RATE_LIMIT_GLOBAL = "nonsense";
    const { GLOBAL_RATE_LIMIT } = await load();
    expect(GLOBAL_RATE_LIMIT.limit).toBe(100);
  });
});
