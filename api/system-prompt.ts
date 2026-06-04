import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import {
  setCorsHeaders,
  handleOptions,
  getTokenFromHeader,
} from "./_helpers.js";
import { prisma } from "./_prisma.js";
import { useOllamaModelfile } from "./ai-providers/prompts.js";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

const verifyAdmin = (
  req: VercelRequest
): { userId: string; email: string } | null => {
  const token = getTokenFromHeader(req);
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
  } catch {
    return null;
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, PUT, OPTIONS");

  if (req.method === "OPTIONS") {
    return handleOptions(req, res);
  }

  const admin = verifyAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await prisma.user.findUnique({
    where: { id: admin.userId },
    select: { role: true },
  });

  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  if (req.method === "PUT") {
    return res.status(410).json({
      error:
        "System prompt editing is disabled. Edit deploy/modelfile/Modelfile on the VPS and run scripts/rebuild-ollama-model.sh",
      source: "modelfile",
    });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const model = process.env.OLLAMA_MODEL || "orion-ai";
  const modelfileEnabled = useOllamaModelfile();

  return res.status(200).json({
    source: modelfileEnabled ? "modelfile" : "database",
    model,
    modelfilePath: "deploy/modelfile/Modelfile",
    rebuildCommand: "./scripts/rebuild-ollama-model.sh",
    instructions:
      "Prompt is baked into the Ollama model on the VPS. Edit the Modelfile, rebuild the model, then restart is optional.",
    prompt: null,
    version: 0,
    updatedAt: null,
  });
}
