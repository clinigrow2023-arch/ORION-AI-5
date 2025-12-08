import { Handler } from "@netlify/functions";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma";
import {
  sendMessageWithFallback,
  generatePlanWithFallback,
} from "./ai-providers/fallback";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

export const handler: Handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Verificar autenticação e acesso ANTES de processar mensagem
    const authHeader =
      event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Authentication required" }),
      };
    }

    const token = authHeader.replace("Bearer ", "");
    let decoded: { userId: string; email: string };

    try {
      decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        email: string;
      };
    } catch (error) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Invalid or expired token" }),
      };
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
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    // IMPORTANTE: Admin sempre tem acesso ilimitado
    // Verificar apenas se usuário está bloqueado (não verifica mais isActive ou accessExpiresAt)
    if (user.role !== "admin") {
      // Verificar se usuário está bloqueado
      if (user.isBlocked) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            error: "Account blocked. Please contact an administrator.",
            blocked: true,
          }),
        };
      }
    }

    const { message, history } = JSON.parse(event.body || "{}");

    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Message is required" }),
      };
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
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Invalid JSON response from AI" }),
          };
        }

        return {
          statusCode: 200,
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            response: jsonText, // Retornar JSON como string para compatibilidade
          }),
        };
      } catch (error: any) {
        console.error("❌ All AI providers failed for plan generation:", error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error:
              error.message ||
              "Failed to generate plan. All AI providers failed.",
          }),
        };
      }
    }

    // Requisição normal de chat - usar sistema de fallback
    try {
      const { response: fullText, provider } = await sendMessageWithFallback(
        message,
        history || []
      );

      console.log(`✅ Message sent using ${provider}`);

      return {
        statusCode: 200,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          response: fullText,
          history: [
            ...(history || []),
            { role: "user", parts: [{ text: message }] },
            { role: "model", parts: [{ text: fullText }] },
          ],
        }),
      };
    } catch (error: any) {
      console.error("❌ All AI providers failed for chat:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error:
            error.message || "Failed to send message. All AI providers failed.",
        }),
      };
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Internal server error",
      }),
    };
  }
};
