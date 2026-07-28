import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import {
  setCorsHeaders,
  handleOptions,
  getTokenFromHeader,
} from "./_helpers.js";
import { prisma } from "./_prisma.js";
import { useOllamaModelfile } from "./ai-providers/prompts.js";
import { apiMessage } from "../lib/api-messages.js";
import type { Locale } from "../lib/locale.js";
import { resolveRequestLocale } from "../lib/server-locale.js";

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

  // Tudo aqui é texto de painel: segue o idioma da UI do admin.
  const locale: Locale = resolveRequestLocale(req);

  const admin = verifyAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: apiMessage(locale, "unauthorized") });
  }

  const user = await prisma.user.findUnique({
    where: { id: admin.userId },
    select: { role: true },
  });

  if (!user || user.role !== "admin") {
    return res
      .status(403)
      .json({ error: apiMessage(locale, "adminRequired") });
  }

  if (req.method === "PUT") {
    return res.status(410).json({
      error: apiMessage(locale, "promptEditingDisabled"),
      source: "modelfile",
    });
  }

  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ error: apiMessage(locale, "methodNotAllowed") });
  }

  const model = process.env.OLLAMA_MODEL || "orion-ai";
  const modelfileEnabled = useOllamaModelfile();

  return res.status(200).json({
    source: modelfileEnabled ? "modelfile" : "database",
    model,
    modelfilePath: "deploy/modelfile/Modelfile",
    rebuildCommand: "./scripts/rebuild-ollama-model.sh",
    instructions: apiMessage(locale, "promptModelfileInfo"),
    prompt: null,
    version: 0,
    updatedAt: null,
  });
}
