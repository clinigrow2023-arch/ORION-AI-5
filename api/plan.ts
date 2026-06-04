import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import { handleOptions, setCorsHeaders } from "./_helpers.js";
import { prisma } from "./_prisma.js";
import { generatePlanWithOllama } from "./ai-providers/orion-ai.js";
import {
  buildPlanContextFromMessages,
  isValidActionPlan,
  normalizeActionPlan,
  parsePlanJsonFromText,
} from "../lib/plan-utils.js";
import { truncatePlanContext } from "./ai-providers/ollama-helpers.js";

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

    const { conversationId, contextHistory } = req.body as {
      conversationId?: string;
      contextHistory?: string;
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

      let messages: Array<{ text?: string; sender?: string }> = [];
      try {
        messages = JSON.parse(conversation.messages || "[]");
      } catch {
        messages = [];
      }

      historyText = buildPlanContextFromMessages(messages);
    }

    historyText = truncatePlanContext(historyText);

    if (!historyText) {
      return res.status(400).json({
        error:
          "No conversation context. Chat with Orion first or select a saved conversation.",
      });
    }

    const raw = await generatePlanWithOllama(historyText);
    const parsed = parsePlanJsonFromText(raw);
    const plan = normalizeActionPlan(parsed);

    if (!isValidActionPlan(plan)) {
      return res.status(502).json({
        error: "Generated plan was incomplete. Please try again.",
      });
    }

    return res.status(200).json({
      plan,
      response: plan,
      provider: "Ollama",
    });
  } catch (error: any) {
    console.error("Plan API Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to generate action plan",
    });
  }
}
