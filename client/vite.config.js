import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": `http://localhost:${loadEnv(mode, fileURLToPath(new URL("../", import.meta.url)), "").PORT || 4000}`,
    },
  },
}));
