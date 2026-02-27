import NextAuth, { type AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { refreshAccessToken } from "@/lib/auth/refreshAccessToken";

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma) as AuthOptions["adapter"],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      if (account && user) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at! * 1000;
        token.userId = user.id;
      }

      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      if (session.user) {
        session.user.id = token.userId as string;
      }
      return session;
    },
    async signIn({ user }) {
      // 初回ログイン時に Settings レコードを自動作成
      if (!user?.id) return true;

      // 念のため、User が DB に実在することを確認する
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true },
      });
      if (!dbUser) {
        // まだアダプター側で User が作成されていない／不整合な場合は何もしない
        return true;
      }

      // Settings は userId をキーに upsert しておく（既にあれば何もしない）
      await prisma.settings.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });

      // ログイン後は常にトップページにリダイレクト
      return "/";
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/signin",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
