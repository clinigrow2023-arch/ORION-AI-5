import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

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
  console.warn('⚠️ DATABASE_URL not found. Prisma Client may not work correctly.');
}

// Criar Prisma Client com tratamento de erro
let prismaInstance: PrismaClient;

try {
  prismaInstance =
    globalForPrisma.prisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaInstance;
  }
} catch (error) {
  console.error('❌ Failed to initialize Prisma Client:', error);
  throw error;
}

export const prisma = prismaInstance;
