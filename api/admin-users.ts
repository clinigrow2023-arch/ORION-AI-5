import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getTokenFromHeader, handleOptions, setCorsHeaders } from "./_helpers.js";
import { prisma } from "./_prisma.js";

export default async function adminUsersHandler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  setCorsHeaders(res);

  try {
    // Verificar autenticação e permissão de administrador
    const token = getTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    let decoded: { userId: string; email: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
        email: string;
      };
    } catch (error) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Verificar se o usuário é administrador consultando o banco de dados
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true },
    });

    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (req.method === "GET") {
      // Listar usuários
      const { page = 1, limit = 500, search = "" } = req.query;

      const pageNumber = parseInt(page as string) || 1;
      const limitNumber = parseInt(limit as string) || 500;
      
      // Impor limite máximo para evitar sobrecarga
      const maxLimit = 500;
      const finalLimit = Math.min(limitNumber, maxLimit);
      const offset = (pageNumber - 1) * limitNumber;

      let whereClause: any = {};
      if (search) {
        whereClause.OR = [
          { name: { contains: search as string, mode: "insensitive" } },
          { email: { contains: search as string, mode: "insensitive" } },
        ];
      }

      const users = await prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isBlocked: true,
          isActive: true,
          subscriptionStatus: true,
          lastPaymentDate: true,
          nextPaymentDate: true,
          createdAt: true,
          updatedAt: true,
          digistoreOrderId: true,
          productId: true,
        },
        skip: offset,
        take: finalLimit,
        orderBy: { createdAt: "desc" },
      });

      const total = await prisma.user.count({ where: whereClause });

      return res.status(200).json({
        users,
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.ceil(total / limitNumber),
          totalItems: total,
          itemsPerPage: limitNumber,
        },
      });
    } else if (req.method === "POST") {
      // Criar novo usuário (admin)
      const { name, email, password, role = "user" } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          error: "Name, email and password are required",
        });
      }

      // Verificar se email já existe
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        return res.status(409).json({ error: "Email already exists" });
      }

      // Hash da senha
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Criar usuário
      const newUser = await prisma.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: role,
          isActive: true, // Admins geralmente criam usuários ativos
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isBlocked: true,
          isActive: true,
          createdAt: true,
        },
      });

      return res.status(201).json({
        message: "User created successfully",
        user: newUser,
      });
    } else if (req.method === "PUT") {
      // Atualizar usuário
      const { userId, updates } = req.body;

      if (!userId || !updates) {
        return res.status(400).json({
          error: "User ID and updates are required",
        });
      }

      // Não permitir atualizar o próprio papel de admin
      if (userId === decoded.userId && updates.role && updates.role !== "admin") {
        return res.status(403).json({
          error: "Cannot change your own admin role",
        });
      }

      // Atualizar usuário
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updates,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isBlocked: true,
          isActive: true,
          subscriptionStatus: true,
          lastPaymentDate: true,
          nextPaymentDate: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return res.status(200).json({
        message: "User updated successfully",
        user: updatedUser,
      });
    } else if (req.method === "DELETE") {
      // Excluir usuário
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({
          error: "User ID is required",
        });
      }

      // Não permitir excluir o próprio usuário admin
      if (userId === decoded.userId) {
        return res.status(403).json({
          error: "Cannot delete your own account",
        });
      }

      await prisma.user.delete({
        where: { id: userId as string },
      });

      return res.status(200).json({
        message: "User deleted successfully",
      });
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error: any) {
    console.error("Admin Users API Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}