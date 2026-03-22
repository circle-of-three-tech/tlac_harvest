// lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

type ExtendedPrismaClient = ReturnType<typeof makePrismaClient>;

function makePrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  }).$extends(withAccelerate());
}

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? makePrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
