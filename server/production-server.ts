/**
 * Orion AI — production server (VPS)
 * Serves built frontend (dist/) + all API routes on one port.
 */
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT || 3000);

if (!process.env.DATABASE_URL) {
  console.error("[production-server] DATABASE_URL is required in .env");
  process.exit(1);
}

import adminUsersHandler from "../api/admin-users.js";
import authHandler from "../api/auth.js";
import chatHandler from "../api/chat.js";
import planHandler from "../api/plan.js";
import conversationsHandler from "../api/conversations.js";
import digistoreIpnHandler from "../api/digistore-ipn.js";
import systemPromptHandler from "../api/system-prompt.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  "/api/digistore-ipn",
  express.raw({ type: "application/x-www-form-urlencoded" }),
  (req: any, _res: any, next: any) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body.toString("utf-8");
      const postData: Record<string, string> = {};
      try {
        const params = new URLSearchParams(req.rawBody);
        params.forEach((value, key) => {
          postData[key] = value;
        });
        req.body = postData;
      } catch {
        req.body = {};
      }
    }
    next();
  }
);

app.use(express.urlencoded({ extended: true }));

const api =
  (handler: (req: any, res: any) => Promise<any>) =>
  (req: express.Request, res: express.Response) =>
    handler(req, res);

app.options("/api/:functionName", (_req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Stream"
  );
  res.sendStatus(200);
});

app.post("/api/auth-register", api(authHandler));
app.post("/api/auth-login", api(authHandler));
app.get("/api/auth-verify", api(authHandler));
app.put("/api/change-password", api(authHandler));
app.post("/api/set-new-password", api(authHandler));

app.get("/api/conversations", api(conversationsHandler));
app.post("/api/conversations", api(conversationsHandler));
app.put("/api/conversations", api(conversationsHandler));
app.patch("/api/conversations", api(conversationsHandler));
app.delete("/api/conversations", api(conversationsHandler));

app.get("/api/admin-users", api(adminUsersHandler));
app.post("/api/admin-users", api(adminUsersHandler));
app.put("/api/admin-users", api(adminUsersHandler));
app.delete("/api/admin-users", api(adminUsersHandler));

app.post("/api/digistore-ipn", api(digistoreIpnHandler));

app.get("/api/system-prompt", api(systemPromptHandler));
app.put("/api/system-prompt", api(systemPromptHandler));

app.post("/api/chat", api(chatHandler));
app.post("/api/plan", api(planHandler));
/** @deprecated use /api/chat — kept for older clients */
app.post("/api/gemini", api(chatHandler));

app.use(express.static(DIST));

app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(DIST, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  const modelfile =
    process.env.OLLAMA_USE_MODELFILE === "1" ||
    process.env.OLLAMA_USE_MODELFILE === "true";
  console.log(`✅ Orion production server http://0.0.0.0:${PORT}`);
  console.log(`   Ollama: ${process.env.OLLAMA_URL || "http://127.0.0.1:11434"}`);
  console.log(`   Chat model: ${process.env.OLLAMA_MODEL || "llama3-8b-fast"}`);
  console.log(
    `   Plan model: ${process.env.OLLAMA_PLAN_MODEL || process.env.OLLAMA_BASE_MODEL || "llama3.2:3b"}`
  );
  console.log(
    `   Prompt: ${modelfile ? "Modelfile (no API system field)" : "database/API"}`
  );
  console.log(
    `   Queue: max ${process.env.OLLAMA_APP_MAX_CONCURRENT || 4} concurrent, wait ${process.env.OLLAMA_QUEUE_MAX_WAIT_MS || 45000}ms`
  );
});
