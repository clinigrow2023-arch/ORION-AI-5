// Prisma Client helper for Vercel serverless functions
// This file ensures Prisma Client is available in the /api directory
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

// Load environment variables if not already loaded
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Verificar se DATABASE_URL está disponível antes de criar Prisma Client
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  // Log removido por segurança (não expor informações de .env)
}

// Criar Prisma Client com tratamento de erro
let prismaInstance: PrismaClient;

try {
  prismaInstance =
    globalForPrisma.prisma ??
    new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaInstance;
  }
} catch (error) {
  // Log removido por segurança (não expor detalhes de erro)
  throw error;
}

export const prisma = prismaInstance;
