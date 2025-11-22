import { Handler } from '@netlify/functions';
import { prisma } from '../../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { email, password } = JSON.parse(event.body || '{}');

    // Validações
    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email and password are required' }),
      };
    }

    const emailLower = email.toLowerCase().trim();
    console.log('Login attempt for email:', emailLower);

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email: emailLower },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        isBlocked: true,
        isActive: true,
        accessExpiresAt: true,
      },
    });

    if (!user) {
      console.log('User not found for email:', emailLower);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid email or password' }),
      };
    }

    console.log('User found:', user.email, 'isBlocked:', user.isBlocked);

    // Verificar se usuário está bloqueado
    if (user.isBlocked) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Account is blocked. Please contact an administrator.' }),
      };
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid email or password' }),
      };
    }

    // Gerar token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isBlocked: user.isBlocked,
          isActive: user.isActive,
          accessExpiresAt: user.accessExpiresAt,
        },
      }),
    };
  } catch (error: any) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal server error',
      }),
    };
  }
};

