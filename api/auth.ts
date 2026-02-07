import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  setCorsHeaders,
  handleOptions,
  getTokenFromHeader,
} from "./_helpers.js";
import { sendSubscriptionExpiredEmail } from "../lib/email.js";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

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
    default:
      return res.status(404).json({ error: "Endpoint not found" });
  }
}

// Função para login
async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verificar se DATABASE_URL está configurada
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        error: "Database configuration error",
        details: "DATABASE_URL environment variable is not set",
      });
    }

    // Verificar se Prisma Client está disponível
    if (!prisma) {
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

// Função para registro
async function handleRegister(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, email, password } = req.body;

    // Validações
    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Name, email and password are required",
      });
    }

    if (name.length < 2) {
      return res
        .status(400)
        .json({ error: "Name must be at least 2 characters" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
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

    return res.status(201).json({
      message: "User created successfully",
      user,
    });
  } catch (error: any) {
    console.error("Register error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}

// Função para verificação de autenticação
async function handleVerify(req: VercelRequest, res: VercelResponse) {
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
        isActive: true,
        passwordResetRequired: true,
        subscriptionStatus: true,
        nextPaymentDate: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // IMPORTANTE: Admin sempre tem acesso ilimitado
    if (user.role !== "admin") {
      // Verificar se usuário está bloqueado
      if (user.isBlocked) {
        return res.status(403).json({
          error: "Account is blocked",
          blocked: true,
        });
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
            await sendSubscriptionExpiredEmail(user.email, user.name || "User");
          } catch (emailError) {
            console.error(
              "Error sending expired subscription email:",
              emailError
            );
            // Não bloquear o processo se email falhar
          }

          return res.status(403).json({
            error: "Your subscription has expired. Please renew your subscription to continue using the service.",
            blocked: true,
            expired: true,
          });
        }
      }

      // Verificar se usuário está inativo
      if (!user.isActive) {
        return res.status(403).json({
          error: "Account is not active",
          blocked: true,
        });
      }
    }

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

// Função para alterar senha
async function handleChangePassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PUT") {
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

    const { currentPassword, newPassword } = req.body;

    // Validações
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters" });
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verificar senha atual
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
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
      message: "Password changed successfully",
    });
  } catch (error: any) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Log removido por segurança
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}

// Função para definir nova senha
async function handleSetNewPassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
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

    const { newPassword, confirmPassword } = req.body;

    // Validações
    if (!newPassword || !confirmPassword) {
      return res
        .status(400)
        .json({ error: "New password and confirmation are required" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        passwordResetRequired: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verificar se realmente precisa resetar senha
    if (!user.passwordResetRequired) {
      return res
        .status(400)
        .json({ error: "Password reset is not required for this account" });
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
      message: "Password set successfully",
    });
  } catch (error: any) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Log removido por segurança
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}