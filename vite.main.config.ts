import { defineConfig } from "vite";

// Forge Vite defaults to [name].js from the entry basename (index.ts → index.js).
// Force main.js so package.json "main" resolves correctly.
// Keep native/heavy packages external so Vite does not bundle optional deps
// (e.g. playwright-core → kerberos) that are resolved at runtime from node_modules.
export default defineConfig({
  build: {
    lib: {
      entry: "src/main/index.ts",
      fileName: () => "main.js",
      formats: ["cjs"]
    },
    rollupOptions: {
      external: ["better-sqlite3", "playwright", "playwright-core"]
    },
    sourcemap: true
  }
});
