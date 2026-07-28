import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import jwt from "jsonwebtoken";
import {
  setCorsHeaders,
  handleOptions,
  getTokenFromHeader,
} from "./_helpers.js";
import {
  parseConversationMessages,
  parseStoredActionPlan,
} from "../lib/plan-utils.js";
import { deriveConversationPreview } from "../lib/conversation-label.js";
import { apiMessage } from "../lib/api-messages.js";
import type { Locale } from "../lib/locale.js";
import { resolveRequestLocale, resolveUserLocale } from "../lib/server-locale.js";

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
  setCorsHeaders(res, "GET, POST, DELETE, OPTIONS, PUT, PATCH");

  if (req.method === "OPTIONS") {
    return handleOptions(req, res);
  }

  // Mensagens seguem o idioma da UI que fez a chamada.
  const locale: Locale = resolveRequestLocale(req);
  // Lacunas do plano salvo são conteúdo da conta: seguem o idioma do usuário.
  let contentLocale: Locale = locale;

  // Verificar autenticação
  const auth = verifyAuth(req);
  if (!auth) {
    return res.status(401).json({ error: apiMessage(locale, "unauthorized") });
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
    return res.status(404).json({ error: apiMessage(locale, "userNotFound") });
  }

  contentLocale = resolveUserLocale(user.locale, req);

  // IMPORTANTE: Admin sempre tem acesso ilimitado
  // Verificar apenas se usuário está bloqueado
  if (user.role !== "admin") {
    if (user.isBlocked) {
      // `blocked` é a flag que o cliente usa para decidir o logout: a mensagem
      // vem traduzida e não serve para comparação.
      return res
        .status(403)
        .json({ error: apiMessage(locale, "accountBlocked"), blocked: true });
    }
  }

  try {
    // GET - Listar conversas ou buscar uma com mensagens (?conversationId=...)
    if (req.method === "GET") {
      const conversationId =
        typeof req.query.conversationId === "string"
          ? req.query.conversationId
          : undefined;

      if (conversationId) {
        const conversation = await prisma.conversation.findFirst({
          where: { id: conversationId, userId: auth.userId },
          select: {
            id: true,
            messages: true,
            actionPlan: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (!conversation) {
          return res
          .status(404)
          .json({ error: apiMessage(locale, "conversationNotFound") });
        }

        const actionPlan = parseStoredActionPlan(
          conversation.actionPlan,
          contentLocale
        );

        return res.status(200).json({
          conversation: {
            id: conversation.id,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            messages: parseConversationMessages(conversation.messages),
            actionPlan: actionPlan ?? undefined,
            hasActionPlan: !!actionPlan,
            preview: deriveConversationPreview(
              parseConversationMessages(conversation.messages)
            ),
          },
        });
      }

      const conversations = await prisma.conversation.findMany({
        where: { userId: auth.userId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          messages: true,
          actionPlan: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const summaryOnly = req.query.summary === "1";

      const parsedConversations = conversations.map((conv) => {
        const raw = conv.messages || "[]";
        if (summaryOnly) {
          const parsedMessages = parseConversationMessages(raw);
          return {
            id: conv.id,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            messageCount: parsedMessages.length,
            hasActionPlan: !!parseStoredActionPlan(conv.actionPlan),
            preview: deriveConversationPreview(parsedMessages),
          };
        }
        return {
          ...conv,
          messages: parseConversationMessages(raw),
        };
      });

      return res.status(200).json({ conversations: parsedConversations });
    }

    // POST - Criar nova conversa
    if (req.method === "POST") {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res
          .status(400)
          .json({ error: apiMessage(locale, "messagesArrayRequired") });
      }

      // IMPORTANTE: Validar limite de 3 conversas por usuário (exceto admin)
      if (user.role !== "admin") {
        const conversationCount = await prisma.conversation.count({
          where: { userId: auth.userId },
        });

        if (conversationCount >= 3) {
          return res.status(403).json({
            error: apiMessage(locale, "maxConversations"),
            maxConversations: true,
          });
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
          messages: parseConversationMessages(conversation.messages),
        },
      });
    }

    // PUT - Atualizar conversa existente
    if (req.method === "PUT") {
      const { conversationId, messages } = req.body;

      if (!conversationId || !messages || !Array.isArray(messages)) {
        return res.status(400).json({
          error: apiMessage(locale, "conversationPayloadRequired"),
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
        return res
          .status(404)
          .json({ error: apiMessage(locale, "conversationNotFound") });
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
          messages: parseConversationMessages(updated.messages),
        },
      });
    }

    // PATCH - Limpar plano salvo (mantém mensagens do chat)
    if (req.method === "PATCH") {
      const { conversationId, clearActionPlan } = req.body as {
        conversationId?: string;
        clearActionPlan?: boolean;
      };

      if (!conversationId) {
        return res
          .status(400)
          .json({ error: apiMessage(locale, "conversationIdRequired") });
      }

      const existingConv = await prisma.conversation.findFirst({
        where: { id: conversationId, userId: auth.userId },
      });

      if (!existingConv) {
        return res
          .status(404)
          .json({ error: apiMessage(locale, "conversationNotFound") });
      }

      if (clearActionPlan) {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { actionPlan: null },
        });
      }

      return res.status(200).json({ success: true, conversationId });
    }

    // DELETE - Deletar conversa
    if (req.method === "DELETE") {
      const { conversationId } = req.body;

      if (!conversationId) {
        return res
          .status(400)
          .json({ error: apiMessage(locale, "conversationIdRequired") });
      }

      // Verificar se a conversa pertence ao usuário
      const existingConv = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId: auth.userId,
        },
      });

      if (!existingConv) {
        return res
          .status(404)
          .json({ error: apiMessage(locale, "conversationNotFound") });
      }

      await prisma.conversation.delete({
        where: { id: conversationId },
      });

      return res.status(200).json({ success: true });
    }

    return res
      .status(405)
      .json({ error: apiMessage(locale, "methodNotAllowed") });
  } catch (error: any) {
    console.error("Conversations error:", error);
    return res.status(500).json({
      error: apiMessage(locale, "internalError"),
    });
  }
}
