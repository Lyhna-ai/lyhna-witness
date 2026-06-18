import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base "./" so the built renderer uses relative asset paths — required when Electron loads the bundle
// from the local filesystem (file://) in production.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  server: {
    port: 5273,
    strictPort: false
  },
  // Vitest: only run the source specs; never the compiled copies under the build outputs.
  test: {
    include: ["core/**/*.spec.ts", "electron/**/*.spec.ts"],
    exclude: ["node_modules", "dist", "dist-electron"]
  }
});
