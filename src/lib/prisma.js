import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis;

function redactDatabaseUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.password) u.password = "********";
    // Avoid leaking any tokens in querystring (rare, but possible)
    u.search = u.search ? "?…" : "";
    return u.toString();
  } catch {
    return "<invalid DATABASE_URL>";
  }
}

function createPrismaClient() {
  // Parse DATABASE_URL for connection config
  const rawDatabaseUrl = process.env.DATABASE_URL?.trim();

  if (!rawDatabaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Set it in your environment (e.g. .env.local) to a MariaDB connection string like: mariadb://USER:PASSWORD@HOST:3306/DB"
    );
  }

  // Some environments (notably Windows env vars) may include surrounding quotes.
  // Next.js dotenv parsing strips quotes in .env files, but system env vars might not.
  let databaseUrl = rawDatabaseUrl;
  if (
    (databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) ||
    (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))
  ) {
    databaseUrl = databaseUrl.slice(1, -1);
  }

  // The mariadb driver expects a `mariadb://` scheme. Many setups use `mysql://`
  // for MariaDB; normalize to avoid runtime/build failures.
  if (databaseUrl.startsWith("mysql://")) {
    databaseUrl = `mariadb://${databaseUrl.slice("mysql://".length)}`;
  }
  
  const url = new URL(databaseUrl);

  // Helpful validation: most local MariaDB/MySQL setups require a password.
  // If yours is passwordless, set DB_ALLOW_EMPTY_PASSWORD=true.
  if (!url.username) {
    throw new Error(
      "DATABASE_URL is missing a username. Expected: mysql://USER:PASSWORD@HOST:3306/DB"
    );
  }
  if (!url.password && process.env.DB_ALLOW_EMPTY_PASSWORD !== "true") {
    throw new Error(
      "DATABASE_URL is missing a password (e.g. mysql://USER:PASSWORD@HOST:3306/DB). If your DB user has an empty password, set DB_ALLOW_EMPTY_PASSWORD=true. If you set DATABASE_URL as a Windows environment variable, it can override .env.local—update/remove it and restart the dev server."
    );
  }

  const database = url.pathname?.replace(/^\//, "");
  if (!database) {
    throw new Error(
      "DATABASE_URL must include a database name (e.g. mysql://user:pass@host:3306/dbname)."
    );
  }

  const connectionLimit = Number(process.env.DB_POOL_CONNECTION_LIMIT ?? 10);
  const acquireTimeout = Number(process.env.DB_POOL_ACQUIRE_TIMEOUT_MS ?? 20000);
  const connectTimeout = Number(process.env.DB_POOL_CONNECT_TIMEOUT_MS ?? 10000);

  // Optional: safe debug output to confirm which URL the server is using.
  // Enable with DB_LOG_CONNECTION_INFO=true (never prints passwords).
  if (process.env.DB_LOG_CONNECTION_INFO === "true") {
    console.log("[db] DATABASE_URL:", redactDatabaseUrl(databaseUrl));
    console.log("[db] host/user/db/hasPassword:", {
      host: url.hostname,
      user: url.username,
      database,
      hasPassword: Boolean(url.password),
      allowEmptyPassword: process.env.DB_ALLOW_EMPTY_PASSWORD === "true",
    });
  }

  // IMPORTANT:
  // `@prisma/adapter-mariadb` expects a *connection config* (or connection string),
  // not an already-created pool. It will create and manage its own pool internally.
  const adapter = new PrismaMariaDb(
    {
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: url.password ? decodeURIComponent(url.password) : undefined,
      database,
      connectionLimit: Number.isFinite(connectionLimit) ? connectionLimit : 10,
      acquireTimeout: Number.isFinite(acquireTimeout) ? acquireTimeout : 20000,
      connectTimeout: Number.isFinite(connectTimeout) ? connectTimeout : 10000,
    },
    {
      database,
      onConnectionError: (err) => {
        console.error("[db] connection error:", err);
      },
    }
  );
  
  // Create Prisma client with adapter
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Allow both import styles:
// - `import { prisma } from "@/lib/prisma"`
// - `import prisma from "@/lib/prisma"`
export default prisma;
