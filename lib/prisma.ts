import { PrismaClient } from "@prisma/client";

// Next.js の開発サーバーはファイルを変更するたびに再起動しますが、
// そのたびに新しい PrismaClient を作ると DB 接続が増え続けてしまいます。
// そのため globalThis（グローバル変数）に1つだけ保持する「シングルトンパターン」を使います。

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // 開発時はSQLクエリをターミナルに表示する（デバッグに便利）
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
