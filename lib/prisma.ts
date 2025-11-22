import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables if not already loaded
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
