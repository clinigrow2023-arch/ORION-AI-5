import { Handler } from "@netlify/functions";
import { prisma } from "../../lib/prisma";
import bcrypt from "bcryptjs";

export const handler: Handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { name, email, password } = JSON.parse(event.body || "{}");

    // Validações
    if (!name || !email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Name, email and password are required",
        }),
      };
    }

    if (name.length < 2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Name must be at least 2 characters" }),
      };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid email format" }),
      };
    }

    if (password.length < 6) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Password must be at least 6 characters",
        }),
      };
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: "Email already registered" }),
      };
    }

    // Hash da senha
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Criar usuário (já ativo por padrão - pode usar a IA imediatamente)
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        isActive: true, // Usuário já pode usar a IA imediatamente após cadastro
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });

    return {
      statusCode: 201,
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "User created successfully",
        user,
      }),
    };
  } catch (error: any) {
    console.error("Register error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Internal server error",
      }),
    };
  }
};
