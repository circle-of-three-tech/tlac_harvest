// lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

type ExtendedPrismaClient = ReturnType<typeof makePrismaClient>;

// Accelerate only adds value against a prisma:// connection string. Applying
// it to a plain postgres:// URL adds call overhead with no caching benefit,
// so skip the extension unless the user has actually wired up Accelerate.
const useAccelerate = (process.env.DATABASE_URL ?? '').startsWith('prisma://');

function makePrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });
  return useAccelerate ? base.$extends(withAccelerate()) : base;
}

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? makePrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
