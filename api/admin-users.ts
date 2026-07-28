import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { apiMessage, type ApiMessageKey } from "../lib/api-messages.js";
import { sendNewUserEmail } from "../lib/email.js";
import { normalizeLocale, type Locale } from "../lib/locale.js";
import { resolveRequestLocale } from "../lib/server-locale.js";
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
  locale: true,
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

  // Mensagens seguem o idioma do painel do admin. E-mails usam o idioma do
  // usuário-alvo, resolvido separadamente em cada operação.
  const locale: Locale = resolveRequestLocale(req);

  const fail = (
    status: number,
    key: ApiMessageKey,
    extra: Record<string, unknown> = {}
  ) => res.status(status).json({ error: apiMessage(locale, key), ...extra });

  try {
    // Verificar autenticação e permissão de administrador
    const token = getTokenFromHeader(req);
    if (!token) {
      return fail(401, "authRequired");
    }

    let decoded: { userId: string; email: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
        email: string;
      };
    } catch (error) {
      return fail(401, "invalidToken");
    }

    // Verificar se o usuário é administrador consultando o banco de dados
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true },
    });

    if (!user || user.role !== "admin") {
      return fail(403, "adminRequired");
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
      const {
        name,
        email,
        password,
        role = "user",
        locale: requestedLocale,
      } = req.body || {};

      if (!name || !email) {
        return fail(400, "nameAndEmailRequired");
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
        return fail(400, "passwordTooShort");
      }

      // Verificar se email já existe
      const existingUser = await prisma.user.findUnique({
        where: { email: String(email).toLowerCase().trim() },
      });

      if (existingUser) {
        return fail(409, "emailAlreadyExists");
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

      // Sem escolha explícita, o novo usuário herda o idioma do admin que o criou.
      const newUserLocale = normalizeLocale(requestedLocale, locale);

      const newUser = await prisma.user.create({
        data: {
          name: String(name).trim(),
          email: String(email).toLowerCase().trim(),
          password: hashedPassword,
          role: normalizedRole,
          isActive: true,
          passwordResetRequired: passwordWasOmitted,
          locale: newUserLocale,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isBlocked: true,
          isActive: true,
          locale: true,
          createdAt: true,
        },
      });

      let emailSent = false;
      if (passwordWasOmitted) {
        try {
          emailSent = await sendNewUserEmail(
            newUser.email,
            newUser.name,
            plainPassword,
            newUserLocale
          );
        } catch {
          emailSent = false;
        }
      }

      return res.status(201).json({
        message: apiMessage(locale, "userCreated"),
        user: newUser,
        emailSent,
        passwordGenerated: passwordWasOmitted,
      });
    } else if (req.method === "PUT") {
      const body = req.body || {};
      const userId = body.userId as string | undefined;

      if (!userId) {
        return fail(400, "userIdRequired");
      }

      // Reset de senha (fluxo do painel)
      if (body.resetPassword === true) {
        const target = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, name: true, locale: true },
        });
        if (!target) {
          return fail(404, "userNotFound");
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
            locale: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        let emailSent = false;
        try {
          emailSent = await sendNewUserEmail(
            target.email,
            target.name,
            tempPassword,
            normalizeLocale(target.locale)
          );
        } catch {
          emailSent = false;
        }

        return res.status(200).json({
          message: apiMessage(locale, "passwordResetDone"),
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
      if (rawUpdates.locale === "en" || rawUpdates.locale === "fr") {
        allowed.locale = rawUpdates.locale;
      }

      if (Object.keys(allowed).length === 0) {
        return fail(400, "noValidUpdates");
      }

      if (userId === decoded.userId && allowed.role && allowed.role !== "admin") {
        return fail(403, "cannotChangeOwnRole");
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
          locale: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return res.status(200).json({
        message: apiMessage(locale, "userUpdated"),
        user: updatedUser,
      });
    } else if (req.method === "DELETE") {
      const userId =
        (typeof req.query.userId === "string" && req.query.userId) ||
        (req.body && typeof req.body.userId === "string" ? req.body.userId : "");

      if (!userId) {
        return fail(400, "userIdRequired");
      }

      // Não permitir excluir o próprio usuário admin
      if (userId === decoded.userId) {
        return fail(403, "cannotDeleteOwnAccount");
      }

      await prisma.user.delete({
        where: { id: userId },
      });

      return res.status(200).json({
        message: apiMessage(locale, "userDeleted"),
      });
    } else {
      return fail(405, "methodNotAllowed");
    }
  } catch (error: any) {
    console.error("Admin Users API Error:", error);
    return fail(500, "internalError");
  }
}
