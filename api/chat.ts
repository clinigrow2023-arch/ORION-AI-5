import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import { handleOptions, setCorsHeaders } from "./_helpers.js";
import { prisma } from "./_prisma.js";
import {
  sendMessageStreamWithOllama,
  sendMessageWithOllama,
} from "./ai-providers/orion-ai.js";
import { isOllamaBusyError } from "../lib/ollama-queue.js";
import { recordAiUsage } from "../lib/ai-usage.js";
import { apiMessage } from "../lib/api-messages.js";
import {
  isUnsupportedLanguageMessage,
  unsupportedLanguageReply,
} from "../lib/language-guard.js";
import type { Locale } from "../lib/locale.js";
import {
  resolveRequestLocale,
  resolveUserLocale,
} from "../lib/server-locale.js";

export default async function chatHandler(
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
  // A resposta da IA segue o idioma da conta, definido após identificar o usuário.
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

    const { message, history = [] } = req.body;

    if (!message) {
      return res
        .status(400)
        .json({ error: apiMessage(locale, "messageRequired") });
    }

    const isStreaming =
      req.query.stream === "true" || req.headers["x-stream"] === "true";

    // Idiomas fora de EN/FR: resposta fixa (não chama o modelo).
    if (isUnsupportedLanguageMessage(String(message))) {
      const refusal = unsupportedLanguageReply(contentLocale);
      if (isStreaming) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        res.write(`data: ${JSON.stringify({ chunk: refusal })}\n\n`);
        res.write(
          `data: ${JSON.stringify({
            done: true,
            response: refusal,
            provider: "Orion",
          })}\n\n`
        );
        res.end();
        return;
      }
      return res.status(200).json({
        response: refusal,
        provider: "Orion",
        history: [
          ...history,
          { role: "user", parts: [{ text: message }] },
          { role: "model", parts: [{ text: refusal }] },
        ],
      });
    }

    recordAiUsage(userId, "chat");

    if (isStreaming) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const keepalive = setInterval(() => {
        res.write(": keepalive\n\n");
      }, 12_000);

      try {
        const response = await sendMessageStreamWithOllama(
          message,
          history,
          (chunk) => {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          },
          contentLocale
        );

        res.write(
          `data: ${JSON.stringify({ done: true, response, provider: "Ollama" })}\n\n`
        );
        res.end();
      } catch (error: any) {
        // Erros do provider são técnicos e em inglês: o cliente traduz pelo
        // `code`, então o texto serve apenas para log/diagnóstico.
        console.error("[chat] stream failed:", {
          message: error?.message,
          code: error?.code,
          status: error?.status,
          provider: error?.provider,
          name: error?.name,
          stack: error?.stack?.split("\n").slice(0, 6).join(" | "),
        });
        const payload = isOllamaBusyError(error)
          ? { error: apiMessage(locale, "aiBusy"), code: "BUSY", retryable: true }
          : { error: apiMessage(locale, "aiUnavailable"), code: "AI_FAILED" };
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        res.end();
      } finally {
        clearInterval(keepalive);
      }
      return;
    }

    const response = await sendMessageWithOllama(
      message,
      history,
      contentLocale
    );

    return res.status(200).json({
      response,
      provider: "Ollama",
      history: [
        ...history,
        { role: "user", parts: [{ text: message }] },
        { role: "model", parts: [{ text: response }] },
      ],
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    if (isOllamaBusyError(error)) {
      return res.status(503).json({
        error: apiMessage(locale, "aiBusy"),
        code: "BUSY",
        retryable: true,
      });
    }
    return res.status(500).json({
      error: apiMessage(locale, "aiUnavailable"),
      code: "AI_FAILED",
    });
  }
}
