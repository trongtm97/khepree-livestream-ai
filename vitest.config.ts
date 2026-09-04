import { defineConfig } from "vitest/config";

/**
 * Unit/integration tests for the parts of the app that do not require Electron.
 *
 * `src/main/**` modules that import `electron` or `better-sqlite3` are excluded
 * on purpose — those need a real Electron runtime and belong to the packaged
 * app smoke test, not this suite.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: ["default"],
    // The live loop uses timers; keep tests honest about async behaviour.
    testTimeout: 15_000
  }
});
