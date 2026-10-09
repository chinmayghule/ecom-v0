import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    swc.vite({
      // Ensure NestJS decorators work
      module: { type: "es6" },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true, // no need to import describe/it/expect
    environment: "node",
    include: ["src/**/*.spec.ts"],
    // Integration specs require a live PostgreSQL and run in their own project
    // (`test:integration`). They match the include glob above, so they must be
    // excluded here — otherwise `pnpm test` tries to connect to a database that
    // is not running and every unit run fails at import.
    exclude: [
      "src/integration/**",
      "node_modules/**",
      "dist/**",
      "**/*.e2e-spec.ts",
      "**/*.integration.spec.ts",
    ],
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
