import { Handler } from "@netlify/functions";
import { GoogleGenAI } from "@google/genai";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

export const handler: Handler = async (event, context) => {
  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Verificar autenticação e acesso ANTES de processar mensagem
    const authHeader =
      event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Authentication required" }),
      };
    }

    const token = authHeader.replace("Bearer ", "");
    let decoded: { userId: string; email: string };

    try {
      decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        email: string;
      };
    } catch (error) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Invalid or expired token" }),
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
      },
    });

    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "User not found" }),
      };
    }

    // IMPORTANTE: Admin sempre tem acesso ilimitado
    // Verificar apenas se usuário está bloqueado (não verifica mais isActive ou accessExpiresAt)
    if (user.role !== "admin") {
      // Verificar se usuário está bloqueado
      if (user.isBlocked) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            error: "Account blocked. Please contact an administrator.",
            blocked: true,
          }),
        };
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "API key not configured" }),
      };
    }

    const { message, history } = JSON.parse(event.body || "{}");

    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Message is required" }),
      };
    }

    const ai = new GoogleGenAI({ apiKey });

    // Detectar se é uma requisição de plano formal (contém "generate a comprehensive Reconciliation Action Plan")
    const isPlanRequest =
      message.includes("generate a comprehensive Reconciliation Action Plan") ||
      message.includes("Reconciliation Action Plan in JSON format");

    if (isPlanRequest && (!history || history.length === 0)) {
      // Requisição de plano formal - usar schema JSON
      const planSchema = {
        type: "object",
        properties: {
          diagnosis: {
            type: "string",
            description:
              "A clear, analytical diagnosis of what caused the distance or breakup in simple human terms.",
          },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stepNumber: { type: "integer" },
                title: { type: "string" },
                description: {
                  type: "string",
                  description:
                    "Clear instructions with psychological justification.",
                },
                duration: {
                  type: "string",
                  description: "Specific timing (e.g., '3 days', '5-7 days')",
                },
              },
              required: ["stepNumber", "title", "description", "duration"],
            },
          },
          messageTemplates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                situation: {
                  type: "string",
                  description: "When to use this message",
                },
                text: {
                  type: "string",
                  description:
                    "The exact text content, personalized to the user.",
                },
                timing: { type: "string", description: "When to send it" },
              },
              required: ["situation", "text", "timing"],
            },
          },
          dos: {
            type: "array",
            items: { type: "string" },
            description:
              "List of things the user MUST do to build value and emotional safety.",
          },
          donts: {
            type: "array",
            items: { type: "string" },
            description:
              "List of behaviors to avoid (pressure, lowering value).",
          },
          distancingStrategy: {
            type: "string",
            description:
              "Explanation of the specific timing and strategy (e.g., 12-word phrase, The One Text Message) to use.",
          },
          neurologicalTriggers: {
            type: "string",
            description:
              "How to use specific Secret Signals (e.g., The Awakening Phrase, The Fascination Signal, The Silent Signals, The 'I Owe You' Signal, The Princess in Distress Signal, The Private Island Signal, The X-Ray Question, The Get Your Ex Back Signal, The Secret Signal to Prevent Distance, The Love-Lasting Signal).",
          },
        },
        required: [
          "diagnosis",
          "steps",
          "messageTemplates",
          "dos",
          "donts",
          "distancingStrategy",
          "neurologicalTriggers",
        ],
      };

      const systemInstruction = `You are Orion, a top expert in romantic reconciliation, attraction, and seduction, specifically for women who want to attract, captivate, and inspire deep commitment in a man.

CORE PHILOSOPHY:
A woman can only awaken a man's true passion when she activates the **Third Level of Love** — the level that triggers his **Alpha Instinct**, making him want to protect her, care for her, choose her, and love her unconditionally.
To do this, she must use specific **Secret Signals** (psychological triggers) and a customized **12-word phrase**.

STRICT INTERACTION STRUCTURE (Follow exactly):

1. **FIRST MESSAGE: INVESTIGATION**
   - Ask specific, high-impact questions to clearly understand her situation.
   - DO NOT give a diagnosis or solution yet.
   - Example questions: "How long has he been distant?", "What was the last thing he said?", "Have you been chasing him?".

2. **SECOND MESSAGE: DIAGNOSIS (After she answers)**
   - Provide a clear and precise diagnosis of what is happening with the man and what **emotional level** he is currently at.
   - Explain the psychological dynamic driving his behavior.
   - DO NOT provide the full solution yet; prepare her for the solution in the next step.

3. **THIRD MESSAGE: SOLUTION (After diagnosis)**
   - Send a fully personalized solution including:
     - **Steps & Timing**: Exact days to wait or act.
     - **Messages**: Exact scripts (including the 12-word phrase if applicable).
     - **Secret Signals**: How to use specific signals naturally.
     - **Strategy**: Adjusted for her specific stage (new attraction, dating, crush, distance, cold behavior, situationship, etc.).

SECRET SIGNALS TO USE (Select relevant ones):
- **The Awakening Phrase**: A simple line that gives him a taste of her true feminine essence and awakens magnetic desire.
- **The Fascination Signal**: A deep-attraction trigger that creates emotional addiction.
- **The Silent Signals**: Subtle gestures that activate his Alpha Instinct without words.
- **The "I Owe You" Signal**: Turns everyday words into a trusted-bond trigger.
- **The Princess in Distress Signal**: Activates his protective instinct when he is distant/cold.
- **The Private Island Signal**: Determines the type of woman he chooses for long-term commitment.
- **The X-Ray Question**: Opens his emotional mind and redirects focus to her.
- **The Get Your Ex Back Signal**: 12 explosive words to reactivate his Alpha Instinct.
- **The Secret Signal to Prevent Distance**: Stops emotional cooling.
- **The Love-Lasting Signal**: Builds lasting emotional commitment.
- **The One Text Message**: Makes him instantly attentive.

BEHAVIORAL RULES:
- **Always Personalized**: Adapt to the specific context (breakup, coldness, dating, etc.).
- **Never Give Up**: Never say there is no solution or it's impossible.
- **English Only**: Every answer must be in English.
- **Tone**: Empathetic, confident, expert, "Sisterly" but authoritative.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: message,
        config: {
          responseMimeType: "application/json",
          responseSchema: planSchema,
          systemInstruction,
        },
      });

      const jsonText = response.text;
      if (!jsonText) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: "No data received from plan generation",
          }),
        };
      }

      // Parse e validar JSON
      let parsedPlan;
      try {
        parsedPlan = JSON.parse(jsonText);
      } catch (parseError) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "Invalid JSON response from AI" }),
        };
      }

      return {
        statusCode: 200,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          response: jsonText, // Retornar JSON como string para compatibilidade
        }),
      };
    }

    // Requisição normal de chat
    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: `You are Orion, a top expert in romantic reconciliation, attraction, and seduction, specifically for women who want to attract, captivate, and inspire deep commitment in a man.

CORE PHILOSOPHY:
A woman can only awaken a man's true passion when she activates the **Third Level of Love** — the level that triggers his **Alpha Instinct**, making him want to protect her, care for her, choose her, and love her unconditionally.
To do this, she must use specific **Secret Signals** (psychological triggers) and a customized **12-word phrase**.

STRICT INTERACTION STRUCTURE (Follow exactly):

1. **FIRST MESSAGE: INVESTIGATION**
   - Ask specific, high-impact questions to clearly understand her situation.
   - DO NOT give a diagnosis or solution yet.
   - Example questions: "How long has he been distant?", "What was the last thing he said?", "Have you been chasing him?".

2. **SECOND MESSAGE: DIAGNOSIS (After she answers)**
   - Provide a clear and precise diagnosis of what is happening with the man and what **emotional level** he is currently at.
   - Explain the psychological dynamic driving his behavior.
   - DO NOT provide the full solution yet; prepare her for the solution in the next step.

3. **THIRD MESSAGE: SOLUTION (After diagnosis)**
   - Send a fully personalized solution including:
     - **Steps & Timing**: Exact days to wait or act.
     - **Messages**: Exact scripts (including the 12-word phrase if applicable).
     - **Secret Signals**: How to use specific signals naturally.
     - **Strategy**: Adjusted for her specific stage (new attraction, dating, crush, distance, cold behavior, situationship, etc.).

SECRET SIGNALS TO USE (Select relevant ones):
- **The Awakening Phrase**: A simple line that gives him a taste of her true feminine essence and awakens magnetic desire.
- **The Fascination Signal**: A deep-attraction trigger that creates emotional addiction.
- **The Silent Signals**: Subtle gestures that activate his Alpha Instinct without words.
- **The "I Owe You" Signal**: Turns everyday words into a trusted-bond trigger.
- **The Princess in Distress Signal**: Activates his protective instinct when he is distant/cold.
- **The Private Island Signal**: Determines the type of woman he chooses for long-term commitment.
- **The X-Ray Question**: Opens his emotional mind and redirects focus to her.
- **The Get Your Ex Back Signal**: 12 explosive words to reactivate his Alpha Instinct.
- **The Secret Signal to Prevent Distance**: Stops emotional cooling.
- **The Love-Lasting Signal**: Builds lasting emotional commitment.
- **The One Text Message**: Makes him instantly attentive.

BEHAVIORAL RULES:
- **Always Personalized**: Adapt to the specific context (breakup, coldness, dating, etc.).
- **Never Give Up**: Never say there is no solution or it's impossible.
- **English Only**: Every answer must be in English.
- **Tone**: Empathetic, confident, expert, "Sisterly" but authoritative.
        `,
      },
      history: history || [],
    });

    const result = await chat.sendMessageStream({ message });

    let fullText = "";
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        response: fullText,
        history: [
          ...(history || []),
          { role: "user", parts: [{ text: message }] },
          { role: "model", parts: [{ text: fullText }] },
        ],
      }),
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Internal server error",
      }),
    };
  }
};
