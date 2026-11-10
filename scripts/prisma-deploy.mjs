import { execSync } from "node:child_process";

// Apply production migrations. SQLite local dev uses `prisma db push`.
const provider = (process.env.DATABASE_PROVIDER ?? "sqlite").toLowerCase();
if (provider !== "postgresql" && provider !== "postgres") {
  console.log("[prisma] DATABASE_PROVIDER is not postgresql; skipping migrate deploy (use db:push for local SQLite).");
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.error("[prisma] DATABASE_URL is required for migrate deploy.");
  process.exit(1);
}
console.log("[prisma] applying postgres migrations");
execSync("npx prisma migrate deploy --schema prisma/postgres/schema.prisma", { stdio: "inherit" });
