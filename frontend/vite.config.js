import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `npm run dev`, the backend runs separately (default port 8000).
// This proxies API + WebSocket calls so the browser can just call
// same-origin paths like "/api/commands" and "/ws".
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
