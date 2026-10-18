import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Mesmo padrão de lib/db.ts: na Vercel a variável não precisa ser cadastrada.
    url: process.env.DATABASE_URL ?? "file:./bncc.db",
  },
});
