/**
 * Every rate limit in the application, in one place.
 *
 * Two independent limits apply to authentication and they are not
 * interchangeable:
 *
 * - **Per-IP** (this file, via Nest's ThrottlerGuard) bounds the *caller*. It
 *   is what stops credential stuffing, where one attacker works through a
 *   leaked address list and no individual account ever reaches its own limit.
 * - **Per-account** (`BruteForceService`) bounds a *victim*. It stops an
 *   attacker grinding one password against one known address.
 *
 * Either alone leaves a gap; both together are the OWASP recommendation. The
 * per-account limit is keyed on a hash of the email rather than `userId`, so
 * it also covers addresses with no account, which is most of a leaked list.
 *
 * Values are env-overridable so environments can tighten without a code change.
 * Defaults are the production posture.
 */

function attempts(key: string, fallback: number): number {
  const raw = process.env[key];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const MINUTE = 60_000;

export const RATE_LIMITS = {
  /** Per-IP ceiling for credential stuffing. */
  login: { limit: attempts("RATE_LIMIT_LOGIN", 10), ttl: MINUTE },

  /** Refresh is cheap but rotation is atomic, so replay detection must not be spammed. */
  refresh: { limit: attempts("RATE_LIMIT_REFRESH", 10), ttl: MINUTE },

  /** Per-IP. The per-address limit lives in the reset-token service. */
  forgotPassword: { limit: attempts("RATE_LIMIT_FORGOT", 3), ttl: MINUTE },

  resetPassword: { limit: attempts("RATE_LIMIT_RESET", 5), ttl: MINUTE },

  register: { limit: attempts("RATE_LIMIT_REGISTER", 5), ttl: MINUTE },
} as const;

/** Global default for any route without an explicit `@Throttle`. */
export const GLOBAL_RATE_LIMIT = {
  limit: attempts("RATE_LIMIT_GLOBAL", 100),
  ttl: MINUTE,
} as const;
