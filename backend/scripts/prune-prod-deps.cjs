// Prunes, then verifies, the production dependency tree.
//
// WHY THIS EXISTS
//
// `pnpm install --prod` removes devDependencies, but not TypeORM's *optional
// peer* dependencies, which pnpm auto-installs regardless. Measured on this
// repo, the production tree carried:
//
//   @swc/core + @swc/core-linux-x64-musl   ~32 MB
//   typescript                              ~23 MB
//   ts-node, @types/node                    ~4 MB
//
// None is reachable from dist/ — they are compiler and test tooling — but they
// are roughly a third of the tree and widen the supply chain for no runtime
// benefit.
//
// The cleaner fix is to set `autoInstallPeers=false`, but that is recorded in
// the lockfile: doing it here fails with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH, and
// regenerating the lockfile changes resolution for the whole workspace including
// development. That belongs in its own change, not in a container build.
//
// Kept as a file rather than inline in the Dockerfile so it is reviewable and
// the shell quoting survives.

const fs = require("node:fs");
const path = require("node:path");

const STORE = "node_modules/.pnpm";

// Dropped explicitly: they arrive via optional peers, not devDependencies.
const PRUNE = ["typescript", "ts-node", "@swc/core", "@types/node"];

// Asserted absent afterwards. The prune set plus the devDependencies a
// regression in pnpm's own pruning would let through.
const FORBIDDEN = [
  ...PRUNE,
  "newman",
  "postman-runtime",
  "postman-collection",
  "postman-request",
  "vitest",
  "supertest",
  "unplugin-swc",
  "@nestjs/cli",
  "@nestjs/schematics",
  "@nestjs/testing",
  "@vitest/coverage-v8",
  "@biomejs/biome",
];

/**
 * Matches a store entry against a package name.
 *
 * Two details of pnpm's virtual store layout bite here, and both were learned by
 * shipping an image that failed to notice 55 MB of dev tooling:
 *
 * 1. Scoped names are written with `+`, not `/` — `@swc/core` is stored as
 *    `@swc+core`. Matching on the package.json spelling finds nothing, so the
 *    prune silently did nothing and the guard below happily reported the tree
 *    was clean.
 *
 * 2. A package is followed by `@` (version), `_` (peer suffix) or `-`
 *    (platform binary) — `@swc/core-linux-x64-musl@1.15.33` is a different
 *    package from `@swc/core@1.15.33`, and matching only on `@` leaves the 32 MB
 *    compiler binary in place. Requiring a separator also stops `@swc/core` from
 *    matching `@swc/counter`.
 */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function matcherFor(name) {
  const pattern = escapeRegExp(name).replace("/", "[/+]");
  return new RegExp(`^${pattern}(?:@|-|\\+|_|$)`);
}

const matchesName = (entry, name) => matcherFor(name).test(entry);

const store = fs.readdirSync(STORE);

if (process.argv[2] === "prune") {
  const removed = [];
  for (const entry of store) {
    if (PRUNE.some((name) => matchesName(entry, name))) {
      fs.rmSync(path.join(STORE, entry), { recursive: true, force: true });
      removed.push(entry);
    }
  }

  // Deleting a store entry leaves symlinks pointing at it. They would not break
  // startup (these peers are only required lazily by typeorm's own CLI), but a
  // dangling symlink is a latent failure, so they are collected and removed.
  let dangling = 0;
  for (const pkg of fs.readdirSync(STORE)) {
    const nm = path.join(STORE, pkg, "node_modules");
    if (!fs.existsSync(nm)) continue;
    for (const scopeOrPkg of fs.readdirSync(nm)) {
      const dirs = scopeOrPkg.startsWith("@")
        ? fs
            .readdirSync(path.join(nm, scopeOrPkg))
            .map((p) => `${scopeOrPkg}/${p}`)
        : [scopeOrPkg];
      for (const rel of dirs) {
        const full = path.join(nm, rel);
        if (!fs.lstatSync(full).isSymbolicLink()) continue;
        if (!fs.existsSync(full)) {
          fs.rmSync(full, { force: true });
          dangling++;
        }
      }
    }
  }

  console.log(
    `pruned ${removed.length} packages, removed ${dangling} dangling links`,
  );
  for (const entry of removed) console.log(`  - ${entry}`);
  process.exit(0);
}

const leaked = store.filter((entry) =>
  FORBIDDEN.some((name) => matchesName(entry, name)),
);

if (leaked.length > 0) {
  console.error(
    `dev tooling leaked into the production tree:\n  ${leaked.join("\n  ")}`,
  );
  process.exit(1);
}

console.log(`production tree clean; ${store.length} packages`);
