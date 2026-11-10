import { execSync } from "node:child_process";

// Generate the Prisma client for the selected database provider.
// Local dev defaults to SQLite; production images set DATABASE_PROVIDER=postgresql.
const provider = (process.env.DATABASE_PROVIDER ?? "sqlite").toLowerCase();
const schema =
  provider === "postgresql" || provider === "postgres"
    ? "prisma/postgres/schema.prisma"
    : "prisma/schema.prisma";

console.log(`[prisma] generating client from ${schema}`);
execSync(`npx prisma generate --schema ${schema}`, { stdio: "inherit" });
