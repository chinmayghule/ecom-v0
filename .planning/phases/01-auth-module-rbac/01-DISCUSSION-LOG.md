# Phase 1: Auth Module & RBAC - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 1-Auth Module & RBAC
**Areas discussed:** Ownership checking pattern, Email verification & password reset, Multi-session policy, Login response schema

---

## Ownership Checking Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Reusable OwnershipGuard | Generic guard with entity metadata | |
| Inline in services | Check owner in each service method | |
| Policy/service objects | Separate policy classes per entity | ✓ |

**User's choice:** Policy objects (recommended)
**Notes:** User initially considered OwnershipGuard but was intrigued by policy objects feeling closer to ABAC. Explained the distinction between role-checking (RBAC) and ownership-checking (data-scoped). User chose policy objects.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, admin is always exempt | Policy returns true for admin | ✓ |
| Only for specific policies | Some policies enforce ownership even for admin | |

**User's choice:** Yes, admin always exempt

---

## Email Verification & Password Reset

| Option | Description | Selected |
|--------|-------------|----------|
| No — skip it | Users immediately active, simplest | ✓ |
| Yes, without blocking login | Verification email sent but doesn't block login | |
| Yes, blocking login until verified | Must verify before first login | |

**User's choice:** No — skip it entirely for Phase 1

| Option | Description | Selected |
|--------|-------------|----------|
| No — skip it | Defer password reset to later phase | |
| Yes, basic flow | forgot-password + reset-password with token expiry | ✓ |

**User's choice:** Yes, basic flow

| Option | Description | Selected |
|--------|-------------|----------|
| Mock for now (console.log) | Log reset link to console in dev | ✓ |
| Resend (recommended) | Simple API, generous free tier | |
| Nodemailer + SMTP | Self-hosted SMTP, more flexible | |

**User's choice:** Mock for now (console.log)

---

## Multi-Session Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Yes | Multiple devices simultaneously | ✓ |
| No, single session | Each login invalidates previous | |

**User's choice:** Yes, multiple sessions allowed

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add endpoints | GET /auth/sessions, DELETE /auth/sessions/:id | ✓ |
| Not in Phase 1 | Defer session management UI | |

**User's choice:** Yes, with an extra "log out from all devices" endpoint added

| Option | Description | Selected |
|--------|-------------|----------|
| User agent + IP only | Simple strings from headers | |
| Rich device info | OS, browser, device type, last active | ✓ |

**User's choice:** Rich device info

| Option | Description | Selected |
|--------|-------------|----------|
| Only current session | Delete current session row | ✓ |
| All sessions | Delete all session rows for user | |

**User's choice:** Only current session (log out from all devices is separate endpoint)

---

## Login Response Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Tokens only | { accessToken, refreshToken } | ✓ |
| Tokens + user profile | Also includes user id, email, name, role | |

**User's choice:** Tokens only — but with additional strong opinion: refreshToken should NEVER be in response body, it must be httpOnly cookie only. Also no expiresIn field. Register auto-logs in.

**Notes:** User described their axios interceptor pattern: on 401, silently use refresh token cookie to get new access token, retry original request. This is a locked pattern.

---

## Deferred Ideas

- Email verification — deferred to later phase
- Real email sending provider — password reset uses console.log mock for Phase 1
- Token lifetime specifics — agent discretion on access/refresh token durations

---

## the agent's Discretion

- Token lifetimes (access expiry, refresh expiry)
- JWT signing algorithm (HS256 standard)
- Session entity migration (add device info columns)
- Reset token storage strategy (DB table or JWT)
