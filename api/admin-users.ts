import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import jwt from "jsonwebtoken";
import { setCorsHeaders, handleOptions, getTokenFromHeader } from "./_helpers.js";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Verificar se é admin
const verifyAdmin = (
  req: VercelRequest
): { userId: string; email: string } | null => {
  const token = getTokenFromHeader(req);
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
    };
    return decoded;
  } catch {
    return null;
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res, "GET, POST, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return handleOptions(req, res);
  }

  // Verificar autenticação e admin
  const admin = verifyAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Verificar se é admin
  const user = await prisma.user.findUnique({
    where: { id: admin.userId },
    select: { role: true },
  });

  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }

  try {
    // GET - Listar todos os usuários
    if (req.method === "GET") {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isBlocked: true,
          passwordResetRequired: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json({ users });
    }

    // DELETE - Deletar usuário
    if (req.method === "DELETE") {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      // Não permitir que admin delete sua própria conta
      if (userId === admin.userId) {
        return res
          .status(400)
          .json({ error: "You cannot delete your own account" });
      }

      // Verificar se usuário existe
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Deletar usuário (conversations serão deletadas automaticamente devido ao onDelete: Cascade)
      await prisma.user.delete({
        where: { id: userId },
      });

      return res.status(200).json({
        success: true,
        message: `User ${targetUser.email} deleted successfully`,
      });
    }

    // PUT - Atualizar usuário (bloquear/desbloquear, reset password)
    if (req.method === "PUT") {
      const { userId, isBlocked, resetPassword } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      // Verificar se usuário existe
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const updateData: any = {};
      if (typeof isBlocked === "boolean") {
        updateData.isBlocked = isBlocked;
      }

      // Resetar senha (define passwordResetRequired = true)
      if (resetPassword === true) {
        updateData.passwordResetRequired = true;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
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
          createdAt: true,
        },
      });

      return res.status(200).json({ user: updatedUser });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("Admin users error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}
