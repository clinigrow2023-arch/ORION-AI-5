import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { setCorsHeaders, handleOptions } from "./_helpers";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return handleOptions(req, res);
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verificar se DATABASE_URL está configurada
    if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL not configured");
      return res.status(500).json({
        error: "Database configuration error",
        details: "DATABASE_URL environment variable is not set",
      });
    }

    // Verificar se Prisma Client está disponível
    if (!prisma) {
      console.error("Prisma Client not initialized");
      return res.status(500).json({
        error: "Database client error",
        details: "Prisma Client is not available",
      });
    }

    const { email, password } = req.body;

    // Validações
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const emailLower = email.toLowerCase().trim();
    console.log("Login attempt for email:", emailLower);

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
        passwordResetRequired: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verificar se usuário está bloqueado
    if (user.isBlocked) {
      return res.status(403).json({ error: "Account is blocked" });
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Gerar token JWT
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "30d",
    });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        passwordResetRequired: user.passwordResetRequired || false,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);

    // Verificar se é erro de Prisma
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }

    if (error.name === "PrismaClientInitializationError") {
      console.error("Prisma Client initialization failed:", error.message);
      return res.status(500).json({
        error: "Database connection error",
        details:
          "Failed to connect to database. Please check DATABASE_URL configuration.",
      });
    }

    // Retornar erro mais detalhado em desenvolvimento
    const errorMessage = error.message || "Internal server error";
    const errorDetails =
      process.env.NODE_ENV === "development"
        ? {
            message: errorMessage,
            name: error.name,
            code: error.code,
            stack: error.stack,
          }
        : { message: errorMessage };

    return res.status(500).json({
      error: errorMessage,
      ...errorDetails,
    });
  }
}
