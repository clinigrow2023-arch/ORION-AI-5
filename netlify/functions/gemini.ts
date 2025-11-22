import { Handler } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const handler: Handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Verificar autenticação e acesso ANTES de processar mensagem
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Authentication required' }),
      };
    }

    const token = authHeader.replace('Bearer ', '');
    let decoded: { userId: string; email: string };
    
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    } catch (error) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid or expired token' }),
      };
    }

    // Buscar usuário e verificar acesso
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isBlocked: true,
        isActive: true,
        accessExpiresAt: true,
      },
    });

    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    // IMPORTANTE: Admin sempre tem acesso ilimitado
    // Não verifica isActive ou accessExpiresAt para admin
    if (user.role !== 'admin') {
      // Verificar se usuário está bloqueado
      if (user.isBlocked) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ 
            error: 'Account blocked. Please contact an administrator.',
            blocked: true,
          }),
        };
      }

      // Verificar se usuário tem acesso ativo
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
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API key not configured' }),
      };
    }

    const { message, history } = JSON.parse(event.body || '{}');

    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message is required' }),
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `You are Orion AI, a specialized digital mentor for relationship reconciliation. 
        
        STRICT BEHAVIORAL PROTOCOL (Follow this order exactly):
        
        1. **PHASE 1: INVESTIGATION (The Interview)**
           - When the user first describes their situation, DO NOT offer a solution or plan immediately.
           - Instead, acknowledge their pain briefly and act as a diagnostician.
           - ASK 3-4 strategic, high-impact questions to understand the context. Examples: "Who ended it?", "How long ago?", "Have you been chasing or begging?", "What was the specific reason given?".
           - Wait for the user's answers.

        2. **PHASE 2 & 3: DIAGNOSIS AND STRATEGY (The Pivot)**
           - Once the user answers your questions, you MUST provide the Diagnosis AND the Action Plan in the SAME response.
           - **Step 1: The Diagnosis**: First, provide a clear, analytical diagnosis of *why* the breakup happened psychologically (e.g., "Loss of attraction due to predictability," "Erosion of emotional safety").
           - **Step 2: The Action Plan**: IMMEDIATELY after the diagnosis, provide the personalized strategy. DO NOT wait for the user to ask "What do I do?".
        
        TONE & LANGUAGE:
        - **Language**: ALL OUTPUT MUST BE IN ENGLISH.
        - **Tone**: Warm, Rational, Analytical, Practical. Like a supportive expert friend.`,
      },
      history: history || [],
    });

    const result = await chat.sendMessageStream({ message });
    
    let fullText = '';
    for await (const chunk of result) {
      const text = chunk.text;
      if (text) {
        fullText += text;
      }
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        response: fullText,
        history: [
          ...(history || []),
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ text: fullText }] },
        ],
      }),
    };
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error',
      }),
    };
  }
};

