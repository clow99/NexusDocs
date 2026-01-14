import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/prisma";
import { authConfig } from "@/auth.config";

function userModelHasField(fieldName) {
  try {
    const models = prisma?._runtimeDataModel?.models;
    const user = models?.User;
    return Boolean(user?.fields?.[fieldName]);
  } catch {
    return false;
  }
}

const HAS_DISABLED = userModelHasField("disabled");
const HAS_APP_ADMIN = userModelHasField("appAdmin");

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Support either env name
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,

  adapter: PrismaAdapter(prisma),

  // Use JWT sessions so middleware (Edge) can validate sessions without DB access.
  session: { strategy: "jwt" },

  // Shared config (providers/pages)
  ...authConfig,

  callbacks: {
    async signIn({ user }) {
      // If your schema supports it, block sign-in when disabled.
      if (HAS_DISABLED) {
        try {
          const dbUser = user?.email
            ? await prisma.user.findUnique({
                where: { email: user.email },
                select: { disabled: true },
              })
            : null;
          if (dbUser?.disabled) return false;
        } catch (error) {
          console.error("Error checking disabled status:", error);
        }
      }

      // If your schema supports it, persist appAdmin based on env var.
      if (HAS_APP_ADMIN) {
        const adminEmails = (process.env.ADMIN_EMAILS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        if (user?.email && adminEmails.includes(user.email)) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: user.email },
              select: { appAdmin: true },
            });
            if (dbUser && !dbUser.appAdmin) {
              await prisma.user.update({
                where: { email: user.email },
                data: { appAdmin: true },
              });
              user.appAdmin = true;
            }
          } catch (error) {
            console.error("Error setting appAdmin:", error);
          }
        }
      }

      return true;
    },

    async jwt({ token, user }) {
      // On initial sign-in, `user` is available.
      if (user) {
        token.id = user.id;
        if (HAS_APP_ADMIN) token.appAdmin = Boolean(user.appAdmin);
        if (HAS_DISABLED) token.disabled = Boolean(user.disabled);
        return token;
      }

      // Keep token in sync with DB (admin/disabled can change)
      if (!token?.email) return token;

      const select = {
        id: true,
        ...(HAS_APP_ADMIN ? { appAdmin: true } : {}),
        ...(HAS_DISABLED ? { disabled: true } : {}),
      };

      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select,
        });
        if (!dbUser) return token;

        token.id = dbUser.id;
        if (HAS_APP_ADMIN) token.appAdmin = Boolean(dbUser.appAdmin);
        if (HAS_DISABLED) token.disabled = Boolean(dbUser.disabled);
      } catch (error) {
        console.error("Error syncing auth token:", error);
      }

      return token;
    },

    async session({ session, token, user }) {
      // Preserve any shared session callback behavior first
      const baseSession = authConfig?.callbacks?.session
        ? await authConfig.callbacks.session({ session, token, user })
        : session;

      if (baseSession?.user) {
        baseSession.user.id = token.id ?? token.sub ?? baseSession.user.id;
        if (HAS_APP_ADMIN) baseSession.user.appAdmin = Boolean(token.appAdmin);
        if (HAS_DISABLED) baseSession.user.disabled = Boolean(token.disabled);
      }

      return baseSession;
    },
  },
});
