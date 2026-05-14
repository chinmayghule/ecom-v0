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
    // exclude e2e tests, they use a separate script
  },
});
