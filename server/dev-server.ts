// Development server to simulate Vercel API routes locally
import type { VercelRequest, VercelResponse } from "@vercel/node";
import cors from "cors";
import dotenv from "dotenv";
import express, { type RequestHandler } from "express";

// Load environment variables
dotenv.config();

// Verify DATABASE_URL is loaded and valid
if (!process.env.DATABASE_URL) {
  console.error(
    "\n[dev-server] DATABASE_URL não está definido no ambiente (.env na raiz do projeto).",
    "\n            Sem isso o servidor não sobe na porta 8888 e o Vite retorna ECONNREFUSED em /api/* (ex.: auth-login).",
    "\n            Adicione uma URL MongoDB válida e rode de novo: npm run dev\n"
  );
  process.exit(1);
}

// Clean DATABASE_URL if it has duplicate prefix
let dbUrl = process.env.DATABASE_URL.trim();
if (dbUrl.startsWith("DATABASE_URL=")) {
  dbUrl = dbUrl.replace(/^DATABASE_URL=/, "");
  process.env.DATABASE_URL = dbUrl;
  // Log removido por segurança
}

if (!dbUrl.startsWith("mongodb://") && !dbUrl.startsWith("mongodb+srv://")) {
  console.error(
    "\n[dev-server] DATABASE_URL precisa começar com mongodb:// ou mongodb+srv://",
    "\n            (valor inválido ou corrompido no .env).\n"
  );
  process.exit(1);
}

// Log removido por segurança

// Verify GEMINI_API_KEY is loaded
if (!process.env.GEMINI_API_KEY) {
  // Log removido por segurança (não expor informações de .env)
} else {
  // Log removido por segurança
}

// Import Vercel API functions
import adminUsersHandler from "../api/admin-users.js";
import authHandler from "../api/auth.js";
import conversationsHandler from "../api/conversations.js";
import digistoreIpnHandler from "../api/digistore-ipn.js";
import geminiHandler from "../api/gemini.js";
import systemPromptHandler from "../api/system-prompt.js";

const app = express();
const PORT = 8888;

app.use(cors());

app.use(express.json());

// Para digistore-ipn, capturar body raw e fazer parse manual (não usar express.urlencoded)
app.use(
  "/api/digistore-ipn",
  express.raw({ type: "application/x-www-form-urlencoded" }),
  (req: any, res: any, next: any) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body.toString("utf-8");
      // Log removido por segurança (não expor conteúdo de requisições)

      // Fazer parse manual e popular req.body
      const postData: Record<string, string> = {};
      try {
        const params = new URLSearchParams(req.rawBody);
        // Log removido por segurança

        params.forEach((value, key) => {
          postData[key] = value;
          // Log removido por segurança
        });

        // Log removido por segurança
        req.body = postData;
      } catch (error) {
        // Log removido por segurança
        req.body = {};
      }
    } else {
      // Log removido por segurança
    }
    next();
  }
);

app.use(express.urlencoded({ extended: true })); // Para outras rotas que usam form-urlencoded

// OPTIONS for CORS - handle all API routes (must be before other routes)
app.options("/api/:functionName", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Locale, X-Stream"
  );
  res.sendStatus(200);
});

/**
 * Vercel handlers receive `VercelRequest`/`VercelResponse`, which are supersets
 * of the Express objects this server passes at runtime. The adapter keeps the
 * route table readable and type-checked instead of casting at every call.
 */
type VercelHandler = (
  req: VercelRequest,
  res: VercelResponse
) => void | Promise<unknown>;

const route = (handler: VercelHandler): RequestHandler =>
  handler as unknown as RequestHandler;

// Routes - usando /api/ em vez de /.netlify/functions/
app.post("/api/auth-register", route(authHandler));
app.post("/api/gemini", route(geminiHandler));
app.post("/api/auth-login", route(authHandler));
app.get("/api/auth-verify", route(authHandler));
app.get("/api/conversations", route(conversationsHandler));
app.post("/api/conversations", route(conversationsHandler));
app.put("/api/conversations", route(conversationsHandler));
app.delete("/api/conversations", route(conversationsHandler));
app.get("/api/admin-users", route(adminUsersHandler));
app.post("/api/admin-users", route(adminUsersHandler));
app.put("/api/admin-users", route(adminUsersHandler));
app.delete("/api/admin-users", route(adminUsersHandler));

app.put("/api/change-password", route(authHandler));
app.post("/api/set-new-password", route(authHandler));
app.put("/api/user-locale", route(authHandler));
app.post("/api/digistore-ipn", route(digistoreIpnHandler));
app.get("/api/system-prompt", route(systemPromptHandler));
app.put("/api/system-prompt", route(systemPromptHandler));

app.listen(PORT, () => {
  console.log(`✅ Development server running on http://localhost:${PORT}`);
  console.log(`📡 API routes available at http://localhost:${PORT}/api/`);
});
