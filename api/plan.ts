import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import { handleOptions, setCorsHeaders } from "./_helpers.js";
import { prisma } from "./_prisma.js";
import { generatePlanWithOllama } from "./ai-providers/orion-ai.js";
import {
  buildPlanContextFromMessages,
  isValidActionPlan,
  normalizeActionPlan,
  parseConversationMessages,
  parsePlanJsonFromText,
} from "../lib/plan-utils.js";
import { truncatePlanContext } from "./ai-providers/ollama-helpers.js";
import { isOllamaBusyError } from "../lib/ollama-queue.js";
import { recordAiUsage } from "../lib/ai-usage.js";
import { resolveOllamaPlanModel } from "../lib/ollama-model-env.js";
import { apiMessage } from "../lib/api-messages.js";
import type { Locale } from "../lib/locale.js";
import {
  resolveRequestLocale,
  resolveUserLocale,
} from "../lib/server-locale.js";

export default async function planHandler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  setCorsHeaders(res);

  // Mensagens seguem o idioma da UI que fez a chamada.
  const locale: Locale = resolveRequestLocale(req);
  // O plano é conteúdo da conta: segue o idioma salvo no usuário.
  let contentLocale: Locale = locale;

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(401)
        .json({ error: apiMessage(locale, "authRequired") });
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
      };
      userId = decoded.userId;
    } catch {
      return res
        .status(401)
        .json({ error: apiMessage(locale, "invalidToken") });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBlocked: true, locale: true },
    });

    if (!user || user.isBlocked) {
      return res
        .status(403)
        .json({ error: apiMessage(locale, "accessDenied") });
    }

    contentLocale = resolveUserLocale(user.locale, req);

    if (req.method !== "POST") {
      return res
        .status(405)
        .json({ error: apiMessage(locale, "methodNotAllowed") });
    }

    const { conversationId, contextHistory, regenerate } = req.body as {
      conversationId?: string;
      contextHistory?: string;
      regenerate?: boolean;
    };

    let historyText = (contextHistory || "").trim();

    if (conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId },
        select: { messages: true },
      });

      if (!conversation) {
        return res
          .status(404)
          .json({ error: apiMessage(locale, "conversationNotFound") });
      }

      const messages = parseConversationMessages(conversation.messages);
      historyText = buildPlanContextFromMessages(messages);
    }

    historyText = truncatePlanContext(historyText);

    if (!historyText) {
      return res.status(400).json({
        error: apiMessage(locale, "planNoContext"),
      });
    }

    if (regenerate && conversationId) {
      await prisma.conversation.updateMany({
        where: { id: conversationId, userId },
        data: { actionPlan: null },
      });
    }

    recordAiUsage(userId, "plan");

    console.log(
      `[plan] user=${userId} regenerate=${!!regenerate} ctxChars=${historyText.length} model=${resolveOllamaPlanModel()}`
    );
    const raw = await generatePlanWithOllama(historyText, {
      regenerate: !!regenerate,
      locale: contentLocale,
    });
    const parsed = parsePlanJsonFromText(raw);
    const plan = normalizeActionPlan(parsed, contentLocale);

    if (!isValidActionPlan(plan)) {
      return res.status(502).json({
        error: apiMessage(locale, "planIncomplete"),
        code: "PLAN_INCOMPLETE",
        retryable: true,
      });
    }

    const planJson = JSON.stringify(plan);
    let savedConversationId = conversationId;

    if (!savedConversationId) {
      const latest = await prisma.conversation.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      savedConversationId = latest?.id;
    }

    if (savedConversationId) {
      await prisma.conversation.updateMany({
        where: { id: savedConversationId, userId },
        data: { actionPlan: planJson },
      });
    }

    return res.status(200).json({
      plan,
      response: plan,
      provider: "Ollama",
      conversationId: savedConversationId ?? undefined,
      saved: !!savedConversationId,
    });
  } catch (error: any) {
    console.error("Plan API Error:", error);
    if (isOllamaBusyError(error)) {
      return res.status(503).json({
        error: apiMessage(locale, "aiBusy"),
        code: "BUSY",
        retryable: true,
      });
    }
    return res.status(500).json({
      error: apiMessage(locale, "planFailed"),
      code: "PLAN_FAILED",
      retryable: true,
    });
  }
}
