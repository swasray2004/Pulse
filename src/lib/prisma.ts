import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const rawConnectionString = process.env.DATABASE_URL;

if (!rawConnectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Normalize localhost to 127.0.0.1 to avoid Windows IPv6 ::1 ECONNREFUSED issues
const connectionString = rawConnectionString.replace(
  "@localhost:",
  "@127.0.0.1:",
);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: pg.Pool;
};

const pool =
  globalForPrisma.pgPool ??
  new pg.Pool({
    connectionString,
    max: 5, // Keep connection count low to respect local dev / PGlite limits
    idleTimeoutMillis: 1000, // Quickly release idle connections
    connectionTimeoutMillis: 5000,
  });

pool.on("error", (err) => {
  console.error("[pg:pool] Unexpected error on idle client:", err);
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}