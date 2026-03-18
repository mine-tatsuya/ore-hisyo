// NextAuth の設定ファイル
// このファイルが /api/auth/* のすべてのリクエストを処理します
// （例: /api/auth/signin, /api/auth/callback/google, /api/auth/signout）

import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  // PrismaAdapter: NextAuth のユーザー情報を Neon DB に自動保存
  adapter: PrismaAdapter(prisma) as any,

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // 同じメールアドレスの User が既に存在しても Google アカウントを紐付ける
      // 個人ツールなので問題なし（公開アプリでは注意が必要）
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          // 必要なスコープ（アクセス許可）を指定
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/calendar.events",
          ].join(" "),
          // offline: リフレッシュトークンを取得するために必須
          access_type: "offline",
          // consent: ログインのたびにリフレッシュトークンを再発行
          prompt: "consent",
        },
      },
    }),
  ],

  callbacks: {
    // signIn コールバック: ログイン（再ログイン含む）のたびに呼ばれる
    //
    // 【なぜ必要か？】
    // PrismaAdapter は初回ログイン時しか Account テーブルにトークンを書かない。
    // 再ログインしても DB は古いトークンのまま残るため、
    // セッションなしで動く Cron が invalid_grant エラーになってしまう。
    // ここで明示的に DB を上書きすることで、常に最新トークンが Cron から使えるようになる。
    async signIn({ user, account }) {
      if (account && user.id && account.access_token) {
        const updateData: Record<string, unknown> = {
          access_token: account.access_token,
          expires_at:   account.expires_at ?? null,
          token_type:   account.token_type ?? null,
          scope:        account.scope ?? null,
          id_token:     account.id_token ?? null,
        };
        // refresh_token は Google が毎回返すとは限らないので、あるときだけ上書き
        if (account.refresh_token) {
          updateData.refresh_token = account.refresh_token;
        }
        await prisma.account.updateMany({
          where: { userId: user.id, provider: account.provider },
          data:  updateData,
        });
      }
      return true;
    },

    // jwt コールバック: JWTトークンを作るときに呼ばれる
    async jwt({ token, account }) {
      // 初回ログイン時だけ account に Google のトークンが入ってくる
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;
      }

      // アクセストークンの期限が切れていなければそのまま返す
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // 期限切れの場合はリフレッシュトークンで更新
      return refreshAccessToken(token);
    },

    // session コールバック: セッション情報を作るときに呼ばれる
    async session({ session, token }) {
      // クライアント（ブラウザ）に accessToken を渡す
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      // session.user.id を使えるように userId を追加
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },

  // JWT方式でセッション管理（DBにセッションを保存しない）
  session: {
    strategy: "jwt",
  },

  // カスタムページの設定
  pages: {
    signIn: "/signin",
  },
};

// アクセストークンをリフレッシュする関数
async function refreshAccessToken(token: any) {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();
    if (!response.ok) throw refreshedTokens;

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      // リフレッシュトークンは更新される場合のみ上書き
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch {
    // 失敗した場合はエラーフラグを立てる（フロントで再ログインを促す）
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

// App Router 用のルートハンドラー
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
