# Patches

Applied by pnpm via `patchedDependencies` in the root `package.json`.

## `zxcvbn-ts@2.2.1`

Used directly by `backend/src/auth/validators/is-strong-password.validator.ts`
for password strength estimation. It ships an ESM build whose relative imports
are not valid under Node's ES module resolver, so `import { zxcvbn } from
"zxcvbn-ts"` fails at import time. Two distinct problems, 53 lines total:

**1. Missing file extensions (52 files).** The published `dist/esm/*.js` files
import siblings without extensions:

```js
import { zxcvbn } from "./main";
```

Node's ESM resolver has no extension-search fallback — unlike bundlers and
CommonJS. It resolves that literal specifier, finds no file, and throws
`ERR_MODULE_NOT_FOUND`. The patch rewrites each to `./main.js`.

**2. Missing JSON import attributes (1 file).** `frequency_lists.js` does:

```js
import frequencyListsJSON from "../data/frequency_lists.json";
```

Node requires an import attribute to load JSON as a module:

```js
import frequencyListsJSON from "../data/frequency_lists.json" with { type: "json" };
```

Without it: `ERR_IMPORT_ATTRIBUTE_MISSING`. Note this is *not* a loader
concern — `with { type: "json" }` is language syntax in the importing module,
so no `--experimental-json-modules` flag or custom loader can substitute for
it.

### Why the project takes the patch instead of alternatives

- **Pin an older version.** The 2.2.1 ESM build is the one with the defect;
  older CJS entries resolve but are unmaintained.
- **Drop the dependency.** `zxcvbn-ts` wraps the original `zxcvbn`. Rewriting
  password strength by hand is a poor trade — its dictionary and scoring are
  the part that is hard to do well, and this is a security control.
- **Bundle it at build time.** A bundler would fix resolution, but it adds a
  build step for one leaf dependency and produces a different artifact in dev
  versus the built image — which is how the container shipped broken once
  already.

The patch is small, mechanical, and verifiable: `pnpm install` fails loudly if
it does not apply, and `pnpm build` fails at the import if resolution is still
wrong. It is applied in CI, in the Docker build, and on a fresh clone, so it
cannot be quietly skipped.

### Upgrading

A new `zxcvbn-ts` release may fix this upstream. If it does, remove the entry
from `patchedDependencies` in the root `package.json`, delete this file, and
re-run `pnpm install` — pnpm reports an unapplied patch rather than failing
silently.