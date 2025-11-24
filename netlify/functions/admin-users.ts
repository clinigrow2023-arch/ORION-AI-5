import { Handler } from '@netlify/functions';
import { prisma } from '../../lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Verificar se é admin
const verifyAdmin = (authHeader: string | undefined): { userId: string; email: string } | null => {
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

  // Verificar autenticação e admin
  const admin = verifyAdmin(event.headers.authorization || event.headers.Authorization);
  if (!admin) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  // Verificar se é admin
  const user = await prisma.user.findUnique({
    where: { id: admin.userId },
    select: { role: true },
  });

  if (!user || user.role !== 'admin') {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Forbidden: Admin access required' }),
    };
  }

  try {
    // GET - Listar todos os usuários
    if (event.httpMethod === 'GET') {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isBlocked: true,
          isActive: true,
          accessExpiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ users }),
      };
    }

    // PUT - Atualizar usuário (bloquear/desbloquear, liberar acesso, editar data, alterar role)
    if (event.httpMethod === 'PUT') {
      const { userId, isBlocked, grantAccess, accessExpiresAt, updateExpirationDate, role } = JSON.parse(event.body || '{}');

      if (!userId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'userId is required' }),
        };
      }

      // Verificar se está tentando alterar o próprio role (não permitir)
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!targetUser) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'User not found' }),
        };
      }

      // Não permitir que admin altere seu próprio role
      if (targetUser.id === admin.userId && role) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'You cannot change your own role' }),
        };
      }

      const updateData: any = {};
      if (typeof isBlocked === 'boolean') {
        updateData.isBlocked = isBlocked;
      }
      
      // Atualizar role (admin ou user)
      if (role === 'admin' || role === 'user') {
        updateData.role = role;
      }
      
      // Editar apenas a data de expiração (sem alterar isActive)
      if (updateExpirationDate === true && accessExpiresAt) {
        const customDate = new Date(accessExpiresAt);
        if (isNaN(customDate.getTime())) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid date format for accessExpiresAt' }),
          };
        }
        updateData.accessExpiresAt = customDate;
      } else if (grantAccess === true) {
        // Liberar acesso
        updateData.isActive = true;
        
        // Se foi fornecida uma data customizada, usar ela
        if (accessExpiresAt) {
          const customDate = new Date(accessExpiresAt);
          if (isNaN(customDate.getTime())) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Invalid date format for accessExpiresAt' }),
            };
          }
          updateData.accessExpiresAt = customDate;
        } else {
          // Caso contrário, usar padrão: 1 mês
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1);
          updateData.accessExpiresAt = expiresAt;
        }
      } else if (grantAccess === false) {
        // Revogar acesso
        updateData.isActive = false;
        updateData.accessExpiresAt = null;
      }

      if (Object.keys(updateData).length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'No valid fields to update' }),
        };
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isBlocked: true,
          isActive: true,
          accessExpiresAt: true,
          createdAt: true,
        },
      });

      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user: updatedUser }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error: any) {
    console.error('Admin users error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
      }),
    };
  }
};

