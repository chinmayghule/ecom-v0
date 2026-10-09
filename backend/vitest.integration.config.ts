import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/**
 * Integration tests — these talk to a real PostgreSQL instance.
 *
 * Kept in a separate project from the unit suite on purpose. The unit tests mock
 * every repository, so they exercise TypeScript and control flow but never a
 * single line of SQL. That gap is why a migration that could not apply to an
 * empty database shipped green, and why a lockout counter built on
 * read-modify-write passed a test asserting that read-modify-write.
 *
 * Anything whose correctness depends on SQL semantics — atomicity, ON CONFLICT,
 * foreign keys, cascade behaviour — belongs here, not in a unit test.
 *
 * Requires a reachable Postgres with the schema applied. See AGENTS.md.
 */
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: "node",
    include: ["src/integration/**/*.integration.spec.ts"],
    setupFiles: ["./test/setup.integration.ts"],
    // Integration specs share one database. Running files in parallel would let
    // them truncate each other's fixtures.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
