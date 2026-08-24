import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

const devMode = process.env.AUTH_DEV_MODE === "true";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    ...(devMode
      ? [
          Credentials({
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "email", placeholder: "dev@trell.dev" },
            },
            async authorize(credentials) {
              const email = credentials?.email;
              if (!email || typeof email !== "string") return null;
              // Auto-create or find user
              let user = await prisma.user.findUnique({ where: { email } });
              if (!user) {
                user = await prisma.user.create({ data: { email, name: email.split("@")[0] } });
              }
              return { id: user.id, name: user.name, email: user.email, image: user.image };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) (session.user as { id?: string }).id = user.id;
      return session;
    },
  },
});
