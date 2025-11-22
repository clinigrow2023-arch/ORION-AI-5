import { Handler } from '@netlify/functions';
import { prisma } from '../../lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No token provided' }),
      };
    }

    const token = authHeader.substring(7);

    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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

    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    // Verificar se usuário está bloqueado
    if (user.isBlocked) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          error: 'Account is blocked',
          blocked: true,
        }),
      };
    }

    // Verificar se usuário está ativo e acesso não expirou
    if (!user.isActive) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          error: 'Account access not granted. Please contact an administrator.',
          notActive: true,
        }),
      };
    }

    // Verificar se acesso expirou
    if (user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date()) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          error: 'Your access has expired. Please contact an administrator to renew.',
          expired: true,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valid: true,
        user,
      }),
    };
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      };
    }

    console.error('Verify error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
      }),
    };
  }
};

