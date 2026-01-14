import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe auth helper for middleware (no Prisma adapter / no DB).
export const { auth } = NextAuth(authConfig);

