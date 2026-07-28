import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendSubscriptionExpiredEmail } from "../lib/email.js";
import { apiMessage, type ApiMessageKey } from "../lib/api-messages.js";
import { isLocale, normalizeLocale, type Locale } from "../lib/locale.js";
import { resolveRequestLocale, resolveUserLocale } from "../lib/server-locale.js";
import {
  getTokenFromHeader,
  handleOptions,
  setCorsHeaders,
} from "./_helpers.js";
import { prisma } from "./_prisma.js";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

/** Erro de token: sempre 401 com a mesma mensagem localizada. */
function isJwtError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return name === "JsonWebTokenError" || name === "TokenExpiredError";
}

/**
 * Resposta de erro localizada. Detalhes técnicos ficam apenas no log do
 * servidor: o cliente nunca recebe stack traces nem mensagens internas.
 */
function fail(
  res: VercelResponse,
  status: number,
  locale: Locale,
  key: ApiMessageKey,
  extra: Record<string, unknown> = {}
) {
  return res.status(status).json({ error: apiMessage(locale, key), ...extra });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url || '';
  const pathParts = url.split('/').filter(part => part !== '');
  const path = pathParts.length > 0 ? pathParts[pathParts.length - 1] : '';

  setCorsHeaders(res, "GET, POST, PUT, OPTIONS");

  if (req.method === "OPTIONS") {
    return handleOptions(req, res);
  }

  // Roteamento com base no caminho
  switch (path) {
    case 'auth-login':
      return handleLogin(req, res);
    case 'auth-register':
      return handleRegister(req, res);
    case 'auth-verify':
      return handleVerify(req, res);
    case 'change-password':
      return handleChangePassword(req, res);
    case 'set-new-password':
      return handleSetNewPassword(req, res);
    case 'user-locale':
      return handleUpdateLocale(req, res);
    default:
      return fail(res, 404, resolveRequestLocale(req), "endpointNotFound");
  }
}

// Função para login
async function handleLogin(req: VercelRequest, res: VercelResponse) {
  const requestLocale = resolveRequestLocale(req);

  if (req.method !== "POST") {
    return fail(res, 405, requestLocale, "methodNotAllowed");
  }

  try {
    // Verificar se DATABASE_URL está configurada
    if (!process.env.DATABASE_URL) {
      console.error("Login failed: DATABASE_URL is not set");
      return fail(res, 500, requestLocale, "databaseConfigError");
    }

    // Verificar se Prisma Client está disponível
    if (!prisma) {
      console.error("Login failed: Prisma Client is not available");
      return fail(res, 500, requestLocale, "databaseClientError");
    }

    const { email, password, locale: requestedLocale } = req.body;

    // Validações
    if (!email || !password) {
      return fail(res, 400, requestLocale, "emailAndPasswordRequired");
    }

    const emailLower = email.toLowerCase().trim();
    // Log removido por segurança (não expor emails)

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
        locale: true,
      },
    });

    if (!user) {
      return fail(res, 401, requestLocale, "invalidCredentials");
    }

    // Verificar se usuário está bloqueado
    if (user.isBlocked) {
      return fail(res, 403, normalizeLocale(user.locale, requestLocale), "accountBlocked", {
        blocked: true,
      });
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return fail(res, 401, requestLocale, "invalidCredentials");
    }

    // Escolha explícita feita na tela de login vence e passa a ser a preferência
    // salva; sem escolha explícita, mantemos a do banco.
    let effectiveLocale = resolveUserLocale(user.locale, req);
    if (isLocale(requestedLocale) && requestedLocale !== user.locale) {
      effectiveLocale = requestedLocale;
    }

    if (effectiveLocale !== user.locale) {
      await prisma.user.update({
        where: { id: user.id },
        data: { locale: effectiveLocale },
      });
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
        locale: effectiveLocale,
      },
    });
  } catch (error: any) {
    // Verificar se é erro de Prisma
    if (error.code === "P2002") {
      return fail(res, 409, requestLocale, "emailAlreadyExists");
    }

    if (error.name === "PrismaClientInitializationError") {
      console.error("Prisma Client initialization failed:", error.message);
      return fail(res, 500, requestLocale, "databaseConnectionError");
    }

    console.error("Login error:", error);
    return fail(res, 500, requestLocale, "internalError");
  }
}

// Função para registro
async function handleRegister(req: VercelRequest, res: VercelResponse) {
  const requestLocale = resolveRequestLocale(req);

  if (req.method !== "POST") {
    return fail(res, 405, requestLocale, "methodNotAllowed");
  }

  try {
    const { name, email, password, locale: requestedLocale } = req.body;

    // Validações
    if (!name || !email || !password) {
      return fail(res, 400, requestLocale, "registrationFieldsRequired");
    }

    if (name.length < 2) {
      return fail(res, 400, requestLocale, "nameTooShort");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(res, 400, requestLocale, "invalidEmailFormat");
    }

    if (password.length < 6) {
      return fail(res, 400, requestLocale, "passwordTooShort");
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return fail(res, 409, requestLocale, "emailAlreadyRegistered");
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
        locale: normalizeLocale(requestedLocale, requestLocale),
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        locale: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      message: apiMessage(requestLocale, "userCreated"),
      user,
    });
  } catch (error: any) {
    console.error("Register error:", error);
    return fail(res, 500, requestLocale, "internalError");
  }
}

// Função para verificação de autenticação
async function handleVerify(req: VercelRequest, res: VercelResponse) {
  let locale = resolveRequestLocale(req);

  if (req.method !== "GET") {
    return fail(res, 405, locale, "methodNotAllowed");
  }

  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      return fail(res, 401, locale, "noToken");
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
        isActive: true,
        passwordResetRequired: true,
        subscriptionStatus: true,
        nextPaymentDate: true,
        locale: true,
        createdAt: true,
      },
    });

    if (!user) {
      return fail(res, 401, locale, "userNotFound");
    }

    locale = resolveUserLocale(user.locale, req);

    // IMPORTANTE: Admin sempre tem acesso ilimitado
    if (user.role !== "admin") {
      // Verificar se usuário está bloqueado
      if (user.isBlocked) {
        return fail(res, 403, locale, "accountBlocked", { blocked: true });
      }

      // Verificar se assinatura expirou (nextPaymentDate passou sem pagamento)
      if (user.nextPaymentDate && user.subscriptionStatus === "active") {
        const now = new Date();
        const nextPayment = new Date(user.nextPaymentDate);
        
        // Se a data de pagamento passou, bloquear acesso automaticamente
        if (nextPayment < now) {
          // Log removido por segurança (não expor userId, email ou datas)

          // Bloquear usuário automaticamente
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isActive: false,
              isBlocked: true,
              subscriptionStatus: "payment_missed",
            },
          });

          // Enviar email informando sobre expiração
          try {
            await sendSubscriptionExpiredEmail(
              user.email,
              user.name || "User",
              locale
            );
          } catch (emailError) {
            console.error(
              "Error sending expired subscription email:",
              emailError
            );
            // Não bloquear o processo se email falhar
          }

          return fail(res, 403, locale, "subscriptionExpired", {
            blocked: true,
            expired: true,
          });
        }
      }

      // Verificar se usuário está inativo
      if (!user.isActive) {
        return fail(res, 403, locale, "accountNotActive", {
          blocked: true,
          notActive: true,
        });
      }
    }

    return res.status(200).json({
      valid: true,
      user: {
        ...user,
        locale,
        passwordResetRequired: user.passwordResetRequired || false,
      },
    });
  } catch (error: any) {
    if (isJwtError(error)) {
      return fail(res, 401, locale, "invalidOrExpiredToken");
    }

    console.error("Verify error:", error);
    return fail(res, 500, locale, "internalError");
  }
}

/**
 * Persiste o idioma escolhido pelo usuário. Necessário para que e-mails
 * disparados pelo servidor (renovação, expiração) usem o idioma correto.
 */
async function handleUpdateLocale(req: VercelRequest, res: VercelResponse) {
  const requestLocale = resolveRequestLocale(req);

  if (req.method !== "PUT") {
    return fail(res, 405, requestLocale, "methodNotAllowed");
  }

  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      return fail(res, 401, requestLocale, "noToken");
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const { locale } = req.body;
    if (!isLocale(locale)) {
      return fail(res, 400, requestLocale, "localeRequired");
    }

    await prisma.user.update({
      where: { id: decoded.userId },
      data: { locale },
    });

    return res.status(200).json({
      locale,
      message: apiMessage(locale, "localeUpdated"),
    });
  } catch (error: any) {
    if (isJwtError(error)) {
      return fail(res, 401, requestLocale, "invalidOrExpiredToken");
    }

    console.error("Update locale error:", error);
    return fail(res, 500, requestLocale, "internalError");
  }
}

// Função para alterar senha
async function handleChangePassword(req: VercelRequest, res: VercelResponse) {
  let locale = resolveRequestLocale(req);

  if (req.method !== "PUT") {
    return fail(res, 405, locale, "methodNotAllowed");
  }

  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      return fail(res, 401, locale, "noToken");
    }

    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
    };

    const { currentPassword, newPassword } = req.body;

    // Validações
    if (!currentPassword || !newPassword) {
      return fail(res, 400, locale, "currentAndNewPasswordRequired");
    }

    if (newPassword.length < 6) {
      return fail(res, 400, locale, "newPasswordTooShort");
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return fail(res, 404, locale, "userNotFound");
    }

    locale = resolveUserLocale(user.locale, req);

    // Verificar senha atual
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isPasswordValid) {
      return fail(res, 401, locale, "currentPasswordIncorrect");
    }

    // Hash da nova senha
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Atualizar senha
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });

    return res.status(200).json({
      message: apiMessage(locale, "passwordChanged"),
    });
  } catch (error: any) {
    if (isJwtError(error)) {
      return fail(res, 401, locale, "invalidOrExpiredToken");
    }

    // Log removido por segurança
    console.error("Change password error:", error);
    return fail(res, 500, locale, "internalError");
  }
}

// Função para definir nova senha
async function handleSetNewPassword(req: VercelRequest, res: VercelResponse) {
  let locale = resolveRequestLocale(req);

  if (req.method !== "POST") {
    return fail(res, 405, locale, "methodNotAllowed");
  }

  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      return fail(res, 401, locale, "noToken");
    }

    // Verificar token
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
    };

    const { newPassword, confirmPassword } = req.body;

    // Validações
    if (!newPassword || !confirmPassword) {
      return fail(res, 400, locale, "newPasswordAndConfirmationRequired");
    }

    if (newPassword.length < 6) {
      return fail(res, 400, locale, "passwordTooShort");
    }

    if (newPassword !== confirmPassword) {
      return fail(res, 400, locale, "passwordsDoNotMatch");
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        passwordResetRequired: true,
        locale: true,
      },
    });

    if (!user) {
      return fail(res, 404, locale, "userNotFound");
    }

    locale = resolveUserLocale(user.locale, req);

    // Verificar se realmente precisa resetar senha
    if (!user.passwordResetRequired) {
      return fail(res, 400, locale, "passwordResetNotRequired");
    }

    // Hash da nova senha
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Atualizar senha e remover flag de reset
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetRequired: false,
      },
    });

    return res.status(200).json({
      message: apiMessage(locale, "passwordSet"),
    });
  } catch (error: any) {
    if (isJwtError(error)) {
      return fail(res, 401, locale, "invalidOrExpiredToken");
    }

    // Log removido por segurança
    console.error("Set new password error:", error);
    return fail(res, 500, locale, "internalError");
  }
}
