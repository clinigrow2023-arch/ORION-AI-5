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
          target: "http://127.0.0.1:8888",
          changeOrigin: true,
          configure(proxy) {
            proxy.on("error", (err, _req, res) => {
              const msg = (err as NodeJS.ErrnoException)?.code || err?.message;
              console.error(
                "\n[vite proxy] /api → 127.0.0.1:8888:",
                msg,
                "\n  → API na porta 8888: use `npm run dev` ou `npm run dev:client` (sobem API + Vite).",
                "\n  → Só front, API em outro terminal: `npm run dev:vite-only` + `npm run dev:server`.",
                "\n  → Se a API cair na hora: defina DATABASE_URL (MongoDB) no .env.\n"
              );
              if (res && !res.headersSent && typeof (res as any).writeHead === "function") {
                (res as any).writeHead(502, { "Content-Type": "application/json" });
                (res as any).end(
                  JSON.stringify({
                    error:
                      "API local indisponível (porta 8888). Rode `npm run dev` ou `npm run dev:client`, ou `npm run dev:server` em outro terminal. Confira DATABASE_URL no .env.",
                  })
                );
              }
            });
          },
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
