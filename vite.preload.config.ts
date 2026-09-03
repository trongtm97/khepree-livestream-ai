import { defineConfig } from "vite";

// Keep preload.js distinct from main.js (both entries are named index.ts).
export default defineConfig({
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        entryFileNames: "preload.js",
        chunkFileNames: "preload.js",
        assetFileNames: "preload.[ext]"
      }
    }
  }
});
