# `archive/`

Dead code preserved deliberately. Nothing here is built, linted, or run — filenames use
non-matching extensions so no tool can pick them up by accident.

## `security.e2e-spec.ts.bak`

Written during Phase 01 Wave 4 ("Audit & Polish"), which listed E2E tests as a deliverable.
It was **never committed** — it was swept into a git stash twice during the 2026-06-18 branch
reset and then forgotten. It survived only inside `stash@{0}`/`stash@{1}` until 2026-10-08,
which is why it is preserved here rather than in git history.

### Why it is parked rather than restored

It targets the CSRF implementation that was deliberately removed in commit `092386a`:

```ts
import { doubleCsrf } from "csrf-csrf";                    // dependency removed from package.json
import { CsrfService } from "../src/auth/csrf.service.js"; // file deleted
```

Restored as-is it would break `pnpm test:e2e`, because `vitest.e2e.config.ts` includes
`test/**/*.e2e-spec.ts` and the imports no longer resolve.

### Why CSRF was removed

Access tokens travel in the `Authorization` header, which browsers never attach cross-site. The
refresh token is a cookie with `sameSite: "strict"`, which browsers will not send cross-site. The
double-submit token was therefore redundant for this architecture.

The implementation that existed could not have worked in any case:

- `httpOnly: true` on the CSRF cookie — the double-submit pattern requires JavaScript to read the
  cookie and echo it in the `x-csrf-token` header. No client can do this when the cookie is httpOnly.
- `cookieName: "__Host-psifi.x-csrf-token"` with `secure: process.env.NODE_ENV === "production"` —
  browsers reject `__Host-` cookies unless `secure` is true, so outside production the cookie was
  never set.

**Invariant:** if `sameSite: "strict"` on the refresh cookie is ever relaxed to `lax`/`none`,
REQ-SEC-04 must be reopened and `/auth/refresh` becomes a real CSRF target.

### To revive it

1. `cp archive/security.e2e-spec.ts.bak backend/test/security.e2e-spec.ts`
2. Delete the `csrfSetup` / `doubleCsrfProtection` / `CsrfService` bootstrap and the
   `GET /auth/csrf-token` block.
3. Remove the `x-csrf-token` header assertions from the remaining tests.
4. Run `pnpm test:e2e` — the `pretest:e2e` hook starts a Postgres on port 5433 to match `.env.test`.
5. CI does not run E2E at all. That is Phase 01B item CRIT-05.

### Provenance

Extracted from `stash@{0}^3:backend/test/security.e2e-spec.ts` on 2026-10-08.
Also preserved in `~/ecom-rescue-2026-10-08/all-refs.bundle` and
`~/ecom-rescue-2026-10-08/security.e2e-spec.ts`.