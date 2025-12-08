import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import { prisma } from "./_prisma";
import {
  sendMessageWithFallback,
  generatePlanWithFallback,
} from "./ai-providers/fallback";
import { setCorsHeaders, handleOptions, getTokenFromHeader } from "./_helpers";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return handleOptions(req, res);
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verificar autenticação e acesso ANTES de processar mensagem
    const token = getTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    let decoded: { userId: string; email: string };

    try {
      decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        email: string;
      };
    } catch (error) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Buscar usuário e verificar acesso
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isBlocked: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // IMPORTANTE: Admin sempre tem acesso ilimitado
    // Verificar apenas se usuário está bloqueado (não verifica mais isActive ou accessExpiresAt)
    if (user.role !== "admin") {
      // Verificar se usuário está bloqueado
      if (user.isBlocked) {
        return res.status(403).json({
          error: "Account blocked. Please contact an administrator.",
          blocked: true,
        });
      }
    }

    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Detectar se é uma requisição de plano formal (contém "generate a comprehensive Reconciliation Action Plan")
    const isPlanRequest =
      message.includes("generate a comprehensive Reconciliation Action Plan") ||
      message.includes("Reconciliation Action Plan in JSON format");

    if (isPlanRequest && (!history || history.length === 0)) {
      // Requisição de plano formal - usar sistema de fallback
      try {
        // Extrair contexto do histórico da mensagem
        const contextMatch = message.match(
          /HISTORY:\s*([\s\S]*?)(?:\n\nSTRICT|$)/
        );
        const contextHistory = contextMatch ? contextMatch[1].trim() : "";

        const { response: jsonText, provider } = await generatePlanWithFallback(
          contextHistory
        );

        console.log(`✅ Plan generated using ${provider}`);

        // Parse e validar JSON
        let parsedPlan;
        try {
          parsedPlan = JSON.parse(jsonText);
        } catch (parseError) {
          return res
            .status(500)
            .json({ error: "Invalid JSON response from AI" });
        }

        return res.status(200).json({
          response: jsonText, // Retornar JSON como string para compatibilidade
        });
      } catch (error: any) {
        console.error("❌ All AI providers failed for plan generation:", error);
        return res.status(500).json({
          error:
            error.message ||
            "Failed to generate plan. All AI providers failed.",
        });
      }
    }

    // Requisição normal de chat - usar sistema de fallback
    try {
      const { response: fullText, provider } = await sendMessageWithFallback(
        message,
        history || []
      );

      console.log(`✅ Message sent using ${provider}`);

      return res.status(200).json({
        response: fullText,
        history: [
          ...(history || []),
          { role: "user", parts: [{ text: message }] },
          { role: "model", parts: [{ text: fullText }] },
        ],
      });
    } catch (error: any) {
      console.error("❌ All AI providers failed for chat:", error);
      return res.status(500).json({
        error:
          error.message || "Failed to send message. All AI providers failed.",
      });
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}
