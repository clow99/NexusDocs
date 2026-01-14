import Google from "next-auth/providers/google";

/**
 * Edge-safe NextAuth config (no DB adapter, no Node-only imports).
 * Used by middleware and can be shared with the DB-backed auth instance.
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  // Middleware can't use database sessions (requires adapter/DB).
  // Use JWT so the session can be validated on the Edge runtime.
  session: {
    strategy: "jwt",
  },
  callbacks: {
    session({ session, token, user }) {
      // Make user id available client-side when present.
      if (session.user) {
        // With JWT sessions, token.sub is the canonical user id.
        session.user.id = user?.id ?? token?.sub ?? session.user.id;
      }
      return session;
    },
  },
};

