import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import jwt from "jsonwebtoken";
import {
  setCorsHeaders,
  handleOptions,
  getTokenFromHeader,
} from "./_helpers.js";
import { apiMessage } from "../lib/api-messages.js";
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from "../lib/locale.js";
import { resolveRequestLocale } from "../lib/server-locale.js";
import { clearPromptCache } from "./ai-providers/fallback.js";
import {
  DEFAULT_SYSTEM_PROMPT,
  ensureOrionGuardrails,
} from "../lib/prompt-defaults.js";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Verificar se é admin
const verifyAdmin = (
  req: VercelRequest
): { userId: string; email: string } | null => {
  const token = getTokenFromHeader(req);
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
    };
    return decoded;
  } catch {
    return null;
  }
};

/**
 * Idioma do prompt que o admin está editando. É independente do idioma da UI
 * (`X-Locale`), por isso vem de `promptLocale` e nunca faz fallback para ele.
 */
const resolvePromptLocale = (req: VercelRequest): Locale => {
  const raw =
    (typeof req.query.promptLocale === "string"
      ? req.query.promptLocale
      : undefined) ??
    (typeof req.body?.promptLocale === "string"
      ? req.body.promptLocale
      : undefined);

  return normalizeLocale(raw, DEFAULT_LOCALE);
};

/** Registros anteriores ao i18n não têm `locale` e são tratados como inglês. */
const localeFilter = (locale: Locale) =>
  locale === DEFAULT_LOCALE ? { OR: [{ locale }, { locale: null }] } : { locale };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, PUT, OPTIONS");

  if (req.method === "OPTIONS") {
    return handleOptions(req, res);
  }

  const uiLocale = resolveRequestLocale(req);

  // Verificar autenticação e admin
  const admin = verifyAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: apiMessage(uiLocale, "unauthorized") });
  }

  // Verificar se é admin
  const user = await prisma.user.findUnique({
    where: { id: admin.userId },
    select: { role: true },
  });

  if (!user || user.role !== "admin") {
    return res
      .status(403)
      .json({ error: apiMessage(uiLocale, "adminRequired") });
  }

  const promptLocale = resolvePromptLocale(req);

  try {
    if (req.method === "GET") {
      let systemPrompt = await prisma.systemPrompt.findFirst({
        where: localeFilter(promptLocale),
        orderBy: { updatedAt: "desc" },
      });

      // Sem prompt para este idioma: mostrar o inglês como ponto de partida.
      // `inherited` avisa o admin de que ainda não existe versão dedicada.
      let inherited = false;
      if (!systemPrompt && promptLocale !== DEFAULT_LOCALE) {
        systemPrompt = await prisma.systemPrompt.findFirst({
          where: localeFilter(DEFAULT_LOCALE),
          orderBy: { updatedAt: "desc" },
        });
        inherited = Boolean(systemPrompt);
      }

      // Primeira execução: semear o prompt padrão em inglês.
      if (!systemPrompt) {
        systemPrompt = await prisma.systemPrompt.create({
          data: {
            prompt: DEFAULT_SYSTEM_PROMPT,
            version: 1,
            locale: DEFAULT_LOCALE,
            updatedBy: admin.userId,
          },
        });
        inherited = promptLocale !== DEFAULT_LOCALE;
      }

      return res.status(200).json({
        prompt: ensureOrionGuardrails(systemPrompt.prompt),
        version: systemPrompt.version,
        updatedAt: systemPrompt.updatedAt,
        locale: promptLocale,
        inherited,
      });
    }

    if (req.method === "PUT") {
      const { prompt } = req.body;

      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return res
          .status(400)
          .json({ error: apiMessage(uiLocale, "promptRequired") });
      }

      try {
        const finalPrompt = ensureOrionGuardrails(prompt);

        // Versionar por idioma para o histórico não misturar as línguas.
        const currentPrompt = await prisma.systemPrompt.findFirst({
          where: localeFilter(promptLocale),
          orderBy: { updatedAt: "desc" },
        });

        const newVersion = currentPrompt ? currentPrompt.version + 1 : 1;

        // Criar novo registro (manter histórico)
        const updatedPrompt = await prisma.systemPrompt.create({
          data: {
            prompt: finalPrompt,
            version: newVersion,
            locale: promptLocale,
            updatedBy: admin.userId,
          },
        });

        // Limpar cache para forçar reload do novo prompt
        clearPromptCache();

        return res.status(200).json({
          prompt: updatedPrompt.prompt,
          version: updatedPrompt.version,
          updatedAt: updatedPrompt.updatedAt,
          locale: promptLocale,
          inherited: false,
          message: apiMessage(uiLocale, "promptUpdated"),
        });
      } catch (dbError: any) {
        console.error("Failed to save system prompt:", dbError);
        return res
          .status(500)
          .json({ error: apiMessage(uiLocale, "promptSaveFailed") });
      }
    }

    return res
      .status(405)
      .json({ error: apiMessage(uiLocale, "methodNotAllowed") });
  } catch (error: any) {
    console.error("System prompt handler error:", error);
    return res
      .status(500)
      .json({ error: apiMessage(uiLocale, "internalError") });
  }
}
