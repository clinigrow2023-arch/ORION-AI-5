import { Handler } from "@netlify/functions";
import { prisma } from "../../lib/prisma";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Verificar autenticação
const verifyAuth = (
  authHeader: string | undefined
): { userId: string; email: string } | null => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
    };
    return decoded;
  } catch {
    return null;
  }
};

export const handler: Handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS, PUT",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  // Verificar autenticação
  const auth = verifyAuth(
    event.headers.authorization || event.headers.Authorization
  );
  if (!auth) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
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
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "User not found" }),
    };
  }

  // IMPORTANTE: Admin sempre tem acesso ilimitado
  // Verificar apenas se usuário está bloqueado
  if (user.role !== "admin") {
    if (user.isBlocked) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: "Account is blocked" }),
      };
    }
  }

  try {
    // GET - Buscar conversas do usuário
    if (event.httpMethod === "GET") {
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

      return {
        statusCode: 200,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversations: conversations.map((conv) => ({
            ...conv,
            messages: JSON.parse(conv.messages || "[]"),
          })),
          accessExpiresAt: user.accessExpiresAt,
        }),
      };
    }

    // POST - Criar/atualizar conversa
    if (event.httpMethod === "POST") {
      const { messages, conversationId } = JSON.parse(event.body || "{}");

      if (!Array.isArray(messages)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "messages must be an array" }),
        };
      }

      // Se conversationId foi fornecido, atualizar conversa existente
      if (conversationId) {
        const existingConversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
        });

        if (
          !existingConversation ||
          existingConversation.userId !== auth.userId
        ) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: "Conversation not found" }),
          };
        }

        const conversation = await prisma.conversation.update({
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

        return {
          statusCode: 200,
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversation: {
              ...conversation,
              messages: JSON.parse(conversation.messages),
            },
          }),
        };
      }

      // Criar nova conversa - verificar limite de 3 conversas
      const conversationCount = await prisma.conversation.count({
        where: { userId: auth.userId },
      });

      if (conversationCount >= 3) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            error:
              "Maximum of 3 conversations allowed. Please delete a conversation to create a new one.",
            maxConversations: true,
          }),
        };
      }

      // Criar nova conversa
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

      return {
        statusCode: 200,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversation: {
            ...conversation,
            messages: JSON.parse(conversation.messages),
          },
        }),
      };
    }

    // DELETE - Deletar conversa específica ou todas as conversas
    if (event.httpMethod === "DELETE") {
      const { conversationId } = JSON.parse(event.body || "{}");

      if (conversationId) {
        // Deletar conversa específica
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
        });

        if (!conversation || conversation.userId !== auth.userId) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: "Conversation not found" }),
          };
        }

        await prisma.conversation.delete({
          where: { id: conversationId },
        });

        return {
          statusCode: 200,
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "Conversation deleted successfully",
          }),
        };
      } else {
        // Deletar todas as conversas do usuário
        await prisma.conversation.deleteMany({
          where: { userId: auth.userId },
        });

        return {
          statusCode: 200,
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: "All conversations deleted successfully",
          }),
        };
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error: any) {
    console.error("Conversations error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Internal server error",
      }),
    };
  }
};
