// Development server to simulate Vercel API routes locally
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Verify DATABASE_URL is loaded and valid
if (!process.env.DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL not found in .env file");
  console.error("Please make sure DATABASE_URL is set in your .env file");
  process.exit(1);
}

// Clean DATABASE_URL if it has duplicate prefix
let dbUrl = process.env.DATABASE_URL.trim();
if (dbUrl.startsWith("DATABASE_URL=")) {
  dbUrl = dbUrl.replace(/^DATABASE_URL=/, "");
  process.env.DATABASE_URL = dbUrl;
  console.log("⚠️  Fixed duplicate DATABASE_URL prefix");
}

if (!dbUrl.startsWith("mongodb://") && !dbUrl.startsWith("mongodb+srv://")) {
  console.error(
    '❌ ERROR: DATABASE_URL must start with "mongodb://" or "mongodb+srv://"'
  );
  console.error(`Current value: ${dbUrl.substring(0, 50)}...`);
  process.exit(1);
}

console.log("✅ DATABASE_URL loaded successfully");

// Verify GEMINI_API_KEY is loaded
if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️  WARNING: GEMINI_API_KEY not found in .env file");
  console.warn("The Gemini chat functionality will not work without this key.");
  console.warn("Please add GEMINI_API_KEY to your .env file:");
  console.warn("  GEMINI_API_KEY=your_gemini_api_key_here");
  console.warn("");
} else {
  console.log("✅ GEMINI_API_KEY loaded successfully");
}

// Import Vercel API functions
import authRegisterHandler from "../api/auth-register.js";
import authLoginHandler from "../api/auth-login.js";
import authVerifyHandler from "../api/auth-verify.js";
import conversationsHandler from "../api/conversations.js";
import adminUsersHandler from "../api/admin-users.js";
import geminiHandler from "../api/gemini.js";
import changePasswordHandler from "../api/change-password.js";
import setNewPasswordHandler from "../api/set-new-password.js";
import digistoreIpnHandler from "../api/digistore-ipn.js";

const app = express();
const PORT = 8888;

app.use(cors());

// Middleware para capturar body raw antes do parsing (para digistore-ipn)
app.use("/api/digistore-ipn", (req: any, res: any, next: any) => {
  let data = "";
  req.on("data", (chunk: Buffer) => {
    data += chunk.toString("utf-8");
  });
  req.on("end", () => {
    req.rawBody = data;
    next();
  });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Para form-urlencoded (DigiStore IPN)

// OPTIONS for CORS - handle all API routes (must be before other routes)
app.options("/api/:functionName", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(200);
});

// Routes - usando /api/ em vez de /.netlify/functions/
app.post("/api/auth-register", authRegisterHandler);
app.post("/api/auth-login", authLoginHandler);
app.get("/api/auth-verify", authVerifyHandler);
app.get("/api/conversations", conversationsHandler);
app.post("/api/conversations", conversationsHandler);
app.delete("/api/conversations", conversationsHandler);
app.get("/api/admin-users", adminUsersHandler);
app.post("/api/admin-users", adminUsersHandler);
app.put("/api/admin-users", adminUsersHandler);
app.delete("/api/admin-users", adminUsersHandler);
app.post("/api/gemini", geminiHandler);
app.put("/api/change-password", changePasswordHandler);
app.post("/api/set-new-password", setNewPasswordHandler);
app.post("/api/digistore-ipn", digistoreIpnHandler);

app.listen(PORT, () => {
  console.log(`🚀 Development server running on http://localhost:${PORT}`);
  console.log(`📡 API routes available at http://localhost:${PORT}/api/`);
});
