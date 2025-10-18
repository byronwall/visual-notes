import { type SolidAuthConfig } from "@solid-mediakit/auth";
import Credentials from "@auth/core/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";
import { serverEnv } from "~/env/server";
import { compare } from "bcryptjs";

declare module "@auth/core/types" {
  export interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const authOptions: SolidAuthConfig = {
  // Required for Credentials provider
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account, credentials }) {
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        (token as any).id = (user as any).id;
      }
      return token;
    },
    session({ session, token }) {
      const id = (token as any)?.id ?? (token as any)?.sub;
      if (session.user && id) {
        session.user.id = id as string;
      }
      return session;
    },
  },
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (creds) => {
        const email = (creds as any)?.email?.toString().toLowerCase();
        const password = (creds as any)?.password?.toString();
        if (!email || !password) {
          console.warn("[auth.authorize] Missing email or password");
          return null;
        }
        const user = (await prisma.user.findUnique({
          where: { email },
        })) as any;
        if (!user || !user.passwordHash) {
          console.warn("[auth.authorize] User not found or no passwordHash", {
            email,
          });
          return null;
        }
        const ok = await compare(password, user.passwordHash);
        if (!ok) {
          console.warn("[auth.authorize] Password mismatch", { email });
          return null;
        }

        return {
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? undefined,
          image: user.image ?? undefined,
        } as any;
      },
    }),
  ],
  events: {
    async createUser(message: unknown) {},
    async session(message: unknown) {},
    async signOut(message: unknown) {},
  },
  debug: true,
  basePath: import.meta.env.VITE_AUTH_PATH || "/api/auth",
  secret: serverEnv.AUTH_SECRET,
  trustHost: serverEnv.AUTH_TRUST_HOST === "true" || undefined,
};
