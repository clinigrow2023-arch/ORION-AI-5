import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import { prisma } from "./_prisma.js";
import {
  sendMessageWithFallback,
  sendMessageStreamWithFallback,
  generatePlanWithFallback,
} from "./ai-providers/fallback.js";
import {
  setCorsHeaders,
  handleOptions,
  getTokenFromHeader,
} from "./_helpers.js";
import { sendSubscriptionExpiredEmail } from "../lib/email.js";

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
        name: true,
        role: true,
        isBlocked: true,
        isActive: true,
        subscriptionStatus: true,
        nextPaymentDate: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // IMPORTANTE: Admin sempre tem acesso ilimitado
    if (user.role !== "admin") {
      // Verificar se usuário está bloqueado
      if (user.isBlocked) {
        return res.status(403).json({
          error: "Account blocked. Please contact an administrator.",
          blocked: true,
        });
      }

      // Verificar se assinatura expirou (nextPaymentDate passou sem pagamento)
      if (user.nextPaymentDate && user.subscriptionStatus === "active") {
        const now = new Date();
        const nextPayment = new Date(user.nextPaymentDate);

        // Se a data de pagamento passou, bloquear acesso automaticamente
        if (nextPayment < now) {
          // Log removido por segurança (não expor userId, email ou datas)

          // Bloquear usuário automaticamente
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isActive: false,
              isBlocked: true,
              subscriptionStatus: "payment_missed",
            },
          });

          // Enviar email informando sobre expiração
          try {
            await sendSubscriptionExpiredEmail(user.email, user.name || "User");
          } catch (emailError) {
            console.error(
              "Error sending expired subscription email:",
              emailError
            );
            // Não bloquear o processo se email falhar
          }

          return res.status(403).json({
            error:
              "Your subscription has expired. Please renew your subscription to continue using the service.",
            blocked: true,
            expired: true,
          });
        }
      }

      // Verificar se usuário está inativo
      if (!user.isActive) {
        return res.status(403).json({
          error: "Account is not active. Please contact an administrator.",
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

        // Log removido por segurança

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
        // Log removido por segurança
        return res.status(500).json({
          error:
            error.message ||
            "Failed to generate plan. All AI providers failed.",
        });
      }
    }

    // Verificar se é requisição de streaming (query param ou header)
    const useStreaming = req.query.stream === "true" || req.headers["x-stream"] === "true";
    
    console.log(`[API] Streaming request? ${useStreaming} (query: ${req.query.stream}, header: ${req.headers["x-stream"]})`);

    // Requisição normal de chat - usar sistema de fallback com streaming
    try {
      if (useStreaming) {
        console.log("[API] Setting up SSE streaming response");
        // Configurar headers para streaming (SSE)
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no"); // Desabilitar buffering do nginx

        let fullResponse = "";
        let chunkCount = 0;

        try {
          console.log("[API] Calling sendMessageStreamWithFallback");
          const { response: fullText, provider } = await sendMessageStreamWithFallback(
            message,
            history || [],
            (chunk: string) => {
              // Enviar chunk via SSE
              chunkCount++;
              fullResponse += chunk;
              const sseData = JSON.stringify({ chunk, done: false });
              res.write(`data: ${sseData}\n\n`);
              
              if (chunkCount % 10 === 0) {
                console.log(`[API] Sent ${chunkCount} chunks, total length: ${fullResponse.length}`);
              }
            }
          );

          console.log(`[API] Streaming completed. Total chunks: ${chunkCount}, Final length: ${fullText.length}`);
          // Enviar resposta final
          res.write(`data: ${JSON.stringify({ chunk: "", done: true, response: fullText })}\n\n`);
          res.end();
        } catch (streamError: any) {
          console.error("[API] Streaming error:", streamError);
          res.write(`data: ${JSON.stringify({ error: streamError.message || "Streaming failed" })}\n\n`);
          res.end();
        }
      } else {
        // Modo não-streaming (compatibilidade)
        const { response: fullText, provider } = await sendMessageWithFallback(
          message,
          history || []
        );

        // Validar se a resposta não está vazia
        if (
          !fullText ||
          (typeof fullText === "string" && fullText.trim() === "")
        ) {
          return res.status(500).json({
            error: "AI returned an empty response. Please try again.",
          });
        }

        // Garantir que fullText é uma string
        const responseText =
          typeof fullText === "string" ? fullText : String(fullText);

        return res.status(200).json({
          response: responseText,
          history: [
            ...(history || []),
            { role: "user", parts: [{ text: message }] },
            { role: "model", parts: [{ text: fullText }] },
          ],
        });
      }
    } catch (error: any) {
      if (useStreaming) {
        res.write(`data: ${JSON.stringify({ error: error.message || "Failed to send message" })}\n\n`);
        res.end();
      } else {
        return res.status(500).json({
          error:
            error.message || "Failed to send message. All AI providers failed.",
        });
      }
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}
