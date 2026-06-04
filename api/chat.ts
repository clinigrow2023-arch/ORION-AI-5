import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import { handleOptions, setCorsHeaders } from "./_helpers.js";
import { prisma } from "./_prisma.js";
import {
  sendMessageStreamWithOllama,
  sendMessageWithOllama,
} from "./ai-providers/orion-ai.js";

export default async function chatHandler(
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

    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const isStreaming =
      req.query.stream === "true" || req.headers["x-stream"] === "true";

    if (isStreaming) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      try {
        const response = await sendMessageStreamWithOllama(
          message,
          history,
          (chunk) => {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          }
        );

        res.write(
          `data: ${JSON.stringify({ done: true, response, provider: "Ollama" })}\n\n`
        );
        res.end();
      } catch (error: any) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
      return;
    }

    const response = await sendMessageWithOllama(message, history);

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
    return res
      .status(500)
      .send(`ERROR: ${error.message || "Internal server error"}`);
  }
}
