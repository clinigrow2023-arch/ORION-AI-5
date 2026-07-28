import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import jwt from "jsonwebtoken";
import { apiMessage, type ApiMessageKey } from "../lib/api-messages.js";
import type { Locale } from "../lib/locale.js";
import {
  resolveRequestLocale,
  resolveUserLocale,
} from "../lib/server-locale.js";
import {
  setCorsHeaders,
  handleOptions,
  getTokenFromHeader,
} from "./_helpers.js";

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

  let locale: Locale = resolveRequestLocale(req);

  const fail = (
    status: number,
    key: ApiMessageKey,
    extra: Record<string, unknown> = {}
  ) => res.status(status).json({ error: apiMessage(locale, key), ...extra });

  // Verificar autenticação
  const auth = verifyAuth(req);
  if (!auth) {
    return fail(401, "unauthorized");
  }

  // Verificar se usuário está bloqueado
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      role: true,
      isBlocked: true,
      locale: true,
    },
  });

  if (!user) {
    return fail(404, "userNotFound");
  }

  locale = resolveUserLocale(user.locale, req);

  // IMPORTANTE: Admin sempre tem acesso ilimitado
  // Verificar apenas se usuário está bloqueado
  if (user.role !== "admin") {
    if (user.isBlocked) {
      return fail(403, "accountBlocked", { blocked: true });
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
        messages: parseMessages(conv.id, conv.messages),
      }));

      return res.status(200).json({ conversations: parsedConversations });
    }

    // POST - Criar nova conversa
    if (req.method === "POST") {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return fail(400, "messagesArrayRequired");
      }

      // IMPORTANTE: Validar limite de 3 conversas por usuário (exceto admin)
      if (user.role !== "admin") {
        const conversationCount = await prisma.conversation.count({
          where: { userId: auth.userId },
        });

        if (conversationCount >= 3) {
          return fail(403, "maxConversations", { maxConversations: true });
        }
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
          messages: parseMessages(conversation.id, conversation.messages),
        },
      });
    }

    // PUT - Atualizar conversa existente
    if (req.method === "PUT") {
      const { conversationId, messages } = req.body;

      if (!conversationId || !messages || !Array.isArray(messages)) {
        return fail(400, "conversationPayloadRequired");
      }

      // Verificar se a conversa pertence ao usuário
      const existingConv = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId: auth.userId,
        },
      });

      if (!existingConv) {
        return fail(404, "conversationNotFound");
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
          messages: parseMessages(updated.id, updated.messages),
        },
      });
    }

    // DELETE - Deletar conversa
    if (req.method === "DELETE") {
      const { conversationId } = req.body;

      if (!conversationId) {
        return fail(400, "conversationIdRequired");
      }

      // Verificar se a conversa pertence ao usuário
      const existingConv = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId: auth.userId,
        },
      });

      if (!existingConv) {
        return fail(404, "conversationNotFound");
      }

      await prisma.conversation.delete({
        where: { id: conversationId },
      });

      return res.status(200).json({ success: true });
    }

    return fail(405, "methodNotAllowed");
  } catch (error: any) {
    console.error("Conversations error:", error);
    return fail(500, "internalError");
  }
}

/**
 * Uma conversa corrompida no banco não deve derrubar a listagem inteira:
 * devolvemos um histórico vazio e registramos o problema no log.
 */
function parseMessages(conversationId: string, raw: string | null): unknown[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Invalid conversation payload:", { conversationId });
    return [];
  }
}
