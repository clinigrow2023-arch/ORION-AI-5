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

export default async function planHandler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  setCorsHeaders(res);

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
      };
      userId = decoded.userId;
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBlocked: true },
    });

    if (!user || user.isBlocked) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
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
        return res.status(404).json({ error: "Conversation not found" });
      }

      const messages = parseConversationMessages(conversation.messages);
      historyText = buildPlanContextFromMessages(messages);
    }

    historyText = truncatePlanContext(historyText);

    if (!historyText) {
      return res.status(400).json({
        error:
          "No conversation context. Chat with Orion first or select a saved conversation.",
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
      `[plan] user=${userId} regenerate=${!!regenerate} ctxChars=${historyText.length} model=${process.env.OLLAMA_PLAN_MODEL || "llama3.2:3b"}`
    );
    const raw = await generatePlanWithOllama(historyText, {
      regenerate: !!regenerate,
    });
    const parsed = parsePlanJsonFromText(raw);
    const plan = normalizeActionPlan(parsed);

    if (!isValidActionPlan(plan)) {
      return res.status(502).json({
        error: "Generated plan was incomplete. Please try again.",
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
        error: error.message,
        code: "BUSY",
        retryable: true,
      });
    }
    return res.status(500).json({
      error: "Failed to generate action plan. Please try again.",
      retryable: true,
    });
  }
}
