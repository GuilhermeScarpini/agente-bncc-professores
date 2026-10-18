import "server-only";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient(): PrismaClient {
  // O servidor só lê a base: quem grava é o seed (npm run db:seed-bncc), que abre a própria conexão.
  // Somente leitura também é o que funciona na Vercel, onde o disco da função não aceita escrita.
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./bncc.db",
    readonly: true,
    fileMustExist: true,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Reaproveita a conexão entre recarregamentos do servidor de desenvolvimento (HMR).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
