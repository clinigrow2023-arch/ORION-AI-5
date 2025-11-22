import { Handler } from '@netlify/functions';
import { prisma } from '../../lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Verificar autenticação
const verifyAuth = (authHeader: string | undefined): { userId: string; email: string } | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    return decoded;
  } catch {
    return null;
  }
};

export const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Verificar autenticação
  const auth = verifyAuth(event.headers.authorization || event.headers.Authorization);
  if (!auth) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // Verificar se usuário está bloqueado e tem acesso ativo
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { 
      role: true,
      isBlocked: true, 
      isActive: true,
      accessExpiresAt: true,
    },
  });

  if (!user) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'User not found' }),
    };
  }

  // Admin sempre tem acesso, pular verificações de bloqueio e acesso para admin
  if (user.role !== 'admin') {
    if (user.isBlocked) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Account is blocked' }),
      };
    }

    if (!user.isActive) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Account access not granted. Please contact an administrator.' }),
      };
    }

    // Verificar se acesso expirou
    if (user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date()) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Your access has expired. Please contact an administrator to renew.' }),
      };
    }
  }

  try {
    // GET - Buscar conversas do usuário
    if (event.httpMethod === 'GET') {
      const conversations = await prisma.conversation.findMany({
        where: { userId: auth.userId },
        orderBy: { updatedAt: 'desc' },
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversations: conversations.map(conv => ({
            ...conv,
            messages: JSON.parse(conv.messages || '[]'),
          })),
          accessExpiresAt: user.accessExpiresAt,
        }),
      };
    }

    // POST - Criar/atualizar conversa
    if (event.httpMethod === 'POST') {
      const { messages } = JSON.parse(event.body || '{}');

      if (!Array.isArray(messages)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'messages must be an array' }),
        };
      }

      // Buscar conversa mais recente ou criar nova
      const existingConversation = await prisma.conversation.findFirst({
        where: { userId: auth.userId },
        orderBy: { updatedAt: 'desc' },
      });

      let conversation;
      if (existingConversation) {
        // Atualizar conversa existente
        conversation = await prisma.conversation.update({
          where: { id: existingConversation.id },
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
      } else {
        // Criar nova conversa
        conversation = await prisma.conversation.create({
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
      }

      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation: {
            ...conversation,
            messages: JSON.parse(conversation.messages),
          },
        }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error: any) {
    console.error('Conversations error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
      }),
    };
  }
};

