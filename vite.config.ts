import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
      // Permitir hosts do Cloudflare Tunnel e ngrok para webhooks
      allowedHosts: [
        ".trycloudflare.com",
        ".cloudflare.com",
        ".ngrok.io",
        ".ngrok-free.app",
        ".ngrok-free.dev",
      ],
      proxy: {
        "/api": {
          target: "http://localhost:8888",
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    // Expose VITE_ prefixed vars for development fallback (not bundled in production)
    define: {
      "import.meta.env.VITE_GEMINI_API_KEY": JSON.stringify(
        mode === "development" ? env.GEMINI_API_KEY : ""
      ),
    },
  };
});
