import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendNewUserEmail } from "../lib/email.js";
import { getTokenFromHeader, handleOptions, setCorsHeaders } from "./_helpers.js";
import { prisma } from "./_prisma.js";
import {
  type AccessFilter,
  classifyAccessFilter,
  isUserAccessActive,
} from "../lib/user-access-status.js";

const userListSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isBlocked: true,
  isActive: true,
  accessExpiresAt: true,
  subscriptionStatus: true,
  lastPaymentDate: true,
  nextPaymentDate: true,
  createdAt: true,
  updatedAt: true,
  digistoreOrderId: true,
  productId: true,
} as const;

function matchesUserSearch(
  u: { name: string; email: string },
  search: string
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  );
}

function generateRandomPassword(length: number = 12): string {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const bytes = randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
}

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
      const { page = 1, limit = 500, search = "", status = "all" } =
        req.query;

      const pageNumber = parseInt(page as string) || 1;
      const limitNumber = parseInt(limit as string) || 500;
      const statusFilter = (status as string) as AccessFilter;

      const maxLimit = 500;
      const finalLimit = Math.min(limitNumber, maxLimit);
      const offset = (pageNumber - 1) * finalLimit;
      const now = new Date();
      const searchStr = String(search || "");

      // Uma leitura + filtro em memória: mesma regra dos cards (Prisma/Mongo
      // não replica bem isBlocked ausente vs false para ~1900 usuários).
      const allUsers = await prisma.user.findMany({
        select: userListSelect,
        orderBy: { createdAt: "desc" },
      });

      let activeCount = 0;
      let inactiveCount = 0;
      let blockedCount = 0;
      for (const u of allUsers) {
        const bucket = classifyAccessFilter(u, now);
        if (bucket === "active") activeCount++;
        else if (bucket === "blocked") blockedCount++;
        else inactiveCount++;
      }

      let filtered = allUsers.filter((u) => matchesUserSearch(u, searchStr));

      if (
        statusFilter === "active" ||
        statusFilter === "inactive" ||
        statusFilter === "blocked"
      ) {
        filtered = filtered.filter(
          (u) => classifyAccessFilter(u, now) === statusFilter
        );
      }

      const total = filtered.length;
      const pageUsers = filtered.slice(offset, offset + finalLimit);

      const usersWithAccess = pageUsers.map((u) => ({
        ...u,
        accessStatus: classifyAccessFilter(u, now),
        canUseApp: isUserAccessActive(u, now),
      }));

      return res.status(200).json({
        users: usersWithAccess,
        stats: {
          total: allUsers.length,
          active: activeCount,
          inactive: inactiveCount,
          blocked: blockedCount,
        },
        pagination: {
          currentPage: pageNumber,
          totalPages: Math.max(1, Math.ceil(total / finalLimit)),
          totalItems: total,
          itemsPerPage: finalLimit,
        },
        filter: statusFilter,
      });
    } else if (req.method === "POST") {
      // Criar novo usuário (admin). Senha opcional: se omitida, gera temporária e envia e-mail.
      const { name, email, password, role = "user" } = req.body || {};

      if (!name || !email) {
        return res.status(400).json({
          error: "Name and email are required",
        });
      }

      const normalizedRole = role === "admin" ? "admin" : "user";
      const passwordWasOmitted =
        password === undefined ||
        password === null ||
        String(password).trim() === "";

      let plainPassword = passwordWasOmitted
        ? generateRandomPassword(12)
        : String(password);

      if (!passwordWasOmitted && plainPassword.length < 6) {
        return res.status(400).json({
          error: "Password must be at least 6 characters",
        });
      }

      // Verificar se email já existe
      const existingUser = await prisma.user.findUnique({
        where: { email: String(email).toLowerCase().trim() },
      });

      if (existingUser) {
        return res.status(409).json({ error: "Email already exists" });
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

      const newUser = await prisma.user.create({
        data: {
          name: String(name).trim(),
          email: String(email).toLowerCase().trim(),
          password: hashedPassword,
          role: normalizedRole,
          isActive: true,
          passwordResetRequired: passwordWasOmitted,
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

      let emailSent = false;
      if (passwordWasOmitted) {
        try {
          emailSent = await sendNewUserEmail(
            newUser.email,
            newUser.name,
            plainPassword
          );
        } catch {
          emailSent = false;
        }
      }

      return res.status(201).json({
        message: "User created successfully",
        user: newUser,
        emailSent,
        passwordGenerated: passwordWasOmitted,
      });
    } else if (req.method === "PUT") {
      const body = req.body || {};
      const userId = body.userId as string | undefined;

      if (!userId) {
        return res.status(400).json({
          error: "User ID is required",
        });
      }

      // Reset de senha (fluxo do painel)
      if (body.resetPassword === true) {
        const target = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, name: true },
        });
        if (!target) {
          return res.status(404).json({ error: "User not found" });
        }

        const tempPassword = generateRandomPassword(12);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            password: hashedPassword,
            passwordResetRequired: true,
          },
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

        let emailSent = false;
        try {
          emailSent = await sendNewUserEmail(
            target.email,
            target.name,
            tempPassword
          );
        } catch {
          emailSent = false;
        }

        return res.status(200).json({
          message: "Password reset successfully",
          user: updatedUser,
          emailSent,
        });
      }

      let rawUpdates = body.updates;
      if (!rawUpdates || typeof rawUpdates !== "object") {
        const { userId: _uid, resetPassword: _rp, updates: _u, ...rest } = body;
        rawUpdates = rest;
      }

      const allowed: Record<string, unknown> = {};
      if (typeof rawUpdates.isBlocked === "boolean") {
        allowed.isBlocked = rawUpdates.isBlocked;
      }
      if (typeof rawUpdates.isActive === "boolean") {
        allowed.isActive = rawUpdates.isActive;
      }
      if (typeof rawUpdates.name === "string" && rawUpdates.name.trim()) {
        allowed.name = rawUpdates.name.trim();
      }
      if (rawUpdates.role === "admin" || rawUpdates.role === "user") {
        allowed.role = rawUpdates.role;
      }

      if (Object.keys(allowed).length === 0) {
        return res.status(400).json({
          error: "No valid updates provided",
        });
      }

      if (userId === decoded.userId && allowed.role && allowed.role !== "admin") {
        return res.status(403).json({
          error: "Cannot change your own admin role",
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: allowed as any,
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
      const userId =
        (typeof req.query.userId === "string" && req.query.userId) ||
        (req.body && typeof req.body.userId === "string" ? req.body.userId : "");

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
        where: { id: userId },
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