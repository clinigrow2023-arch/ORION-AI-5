import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import { handleOptions, setCorsHeaders } from "./_helpers.js";
import { prisma } from "./_prisma.js";
import { sendMessageStreamWithFallback, sendMessageWithFallback } from "./ai-providers/fallback.js";

export default async function geminiHandler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  setCorsHeaders(res);

  try {
    // Verificar autenticação
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verificar se o token é válido
    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
      };
      userId = decoded.userId;
    } catch (error) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Verificar se o usuário existe e não está bloqueado
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBlocked: true },
    });

    if (!user || user.isBlocked) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (req.method === "POST") {
      const { message, history = [] } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Verificar se é streaming
      const isStreaming = req.query.stream === "true" || req.headers["x-stream"] === "true";
      
      if (isStreaming) {
        // Resposta de streaming SSE
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });

        try {
          // Enviar mensagem via provedor fallback com streaming
          const { response, provider } = await sendMessageStreamWithFallback(
            message,
            history,
            (chunk) => {
              res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
            }
          );
          
          // Enviar mensagem de conclusão
          res.write(`data: ${JSON.stringify({ done: true, response: response })}\n\n`);
          res.end();
        } catch (error: any) {
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          res.end();
        }
      } else {
        // Resposta normal
        const { response } = await sendMessageWithFallback(message, history);

        return res.status(200).json({ 
          response,
          history: [...history, { role: "user", parts: [{ text: message }] }, { role: "model", parts: [{ text: response }] }]
        });
      }
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}