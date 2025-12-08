import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import jwt from "jsonwebtoken";
import { setCorsHeaders, handleOptions, getTokenFromHeader } from "./_helpers.js";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Verificar autenticação
const verifyAuth = (
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, POST, DELETE, OPTIONS, PUT");

  if (req.method === "OPTIONS") {
    return handleOptions(req, res);
  }

  // Verificar autenticação
  const auth = verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Verificar se usuário está bloqueado
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      role: true,
      isBlocked: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // IMPORTANTE: Admin sempre tem acesso ilimitado
  // Verificar apenas se usuário está bloqueado
  if (user.role !== "admin") {
    if (user.isBlocked) {
      return res.status(403).json({ error: "Account is blocked" });
    }
  }

  try {
    // GET - Buscar conversas do usuário
    if (req.method === "GET") {
      const conversations = await prisma.conversation.findMany({
        where: { userId: auth.userId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          messages: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Parse messages JSON string para objeto
      const parsedConversations = conversations.map((conv) => ({
        ...conv,
        messages: JSON.parse(conv.messages || "[]"),
      }));

      return res.status(200).json({ conversations: parsedConversations });
    }

    // POST - Criar nova conversa
    if (req.method === "POST") {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      const conversation = await prisma.conversation.create({
        data: {
          userId: auth.userId,
          messages: JSON.stringify(messages),
        },
        select: {
          id: true,
          messages: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return res.status(201).json({
        conversation: {
          ...conversation,
          messages: JSON.parse(conversation.messages),
        },
      });
    }

    // PUT - Atualizar conversa existente
    if (req.method === "PUT") {
      const { conversationId, messages } = req.body;

      if (!conversationId || !messages || !Array.isArray(messages)) {
        return res.status(400).json({
          error: "conversationId and messages array are required",
        });
      }

      // Verificar se a conversa pertence ao usuário
      const existingConv = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId: auth.userId,
        },
      });

      if (!existingConv) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const updated = await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          messages: JSON.stringify(messages),
        },
        select: {
          id: true,
          messages: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return res.status(200).json({
        conversation: {
          ...updated,
          messages: JSON.parse(updated.messages),
        },
      });
    }

    // DELETE - Deletar conversa
    if (req.method === "DELETE") {
      const { conversationId } = req.body;

      if (!conversationId) {
        return res.status(400).json({ error: "conversationId is required" });
      }

      // Verificar se a conversa pertence ao usuário
      const existingConv = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId: auth.userId,
        },
      });

      if (!existingConv) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      await prisma.conversation.delete({
        where: { id: conversationId },
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("Conversations error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}
