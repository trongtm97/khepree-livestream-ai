import { defineConfig } from "vite";

// Forge Vite defaults to [name].js from the entry basename (index.ts → index.js).
// Force main.js so package.json "main" resolves correctly.
// Keep better-sqlite3 external so its N-API prebuild loads from node_modules.
export default defineConfig({
  build: {
    lib: {
      entry: "src/main/index.ts",
      fileName: () => "main.js",
      formats: ["cjs"]
    },
    rollupOptions: {
      external: ["better-sqlite3"]
    },
    sourcemap: true
  }
});
