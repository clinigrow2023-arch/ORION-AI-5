import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
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
          console.log("Subscription expired, blocking user:", {
            userId: user.id,
            email: user.email,
            nextPaymentDate: user.nextPaymentDate,
            now: now,
          });

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
