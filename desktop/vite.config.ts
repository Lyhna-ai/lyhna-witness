import { defineConfig } from "vite";
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
  }
});
