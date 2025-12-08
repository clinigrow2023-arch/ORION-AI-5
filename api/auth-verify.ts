import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../lib/prisma";
import jwt from "jsonwebtoken";
import { setCorsHeaders, handleOptions, getTokenFromHeader } from "./_helpers";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return handleOptions(req, res);
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
    };

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isBlocked: true,
        passwordResetRequired: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Verificar se usuário está bloqueado (admin pode estar bloqueado também)
    if (user.isBlocked && user.role !== "admin") {
      return res.status(403).json({
        error: "Account is blocked",
        blocked: true,
      });
    }

    // IMPORTANTE: Admin sempre tem acesso ilimitado
    // Usuários comuns podem usar a IA imediatamente após cadastro (sem necessidade de liberação)

    return res.status(200).json({
      valid: true,
      user: {
        ...user,
        passwordResetRequired: user.passwordResetRequired || false,
      },
    });
  } catch (error: any) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    console.error("Verify error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}
