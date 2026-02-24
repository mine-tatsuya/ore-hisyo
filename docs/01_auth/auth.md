# 認証・認可 要件定義

## 概要

Google OAuth 2.0 と NextAuth.js を組み合わせ、ユーザー認証・セッション管理・APIルート保護を実装する。
Googleトークン（アクセストークン・リフレッシュトークン）は安全に管理し、Google Calendar API への継続的なアクセスを可能にする。

## 対象フェーズ

- **Phase 1 (MVP)**: Google ログイン、セッション管理、保護ルート
- **Phase 2**: リフレッシュトークンの自動更新（Cron Job での利用）

---

## 機能詳細

### 1. Google OAuth 2.0 セットアップ

#### 必要なスコープ
```
openid
email
profile
https://www.googleapis.com/auth/calendar          # カレンダー読み書き
https://www.googleapis.com/auth/calendar.events   # イベントのCRUD
```

#### NextAuth.js 設定（`app/api/auth/[...nextauth]/route.ts`）
```typescript
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
          access_type: "offline",   // リフレッシュトークン取得に必須
          prompt: "consent",        // 毎回リフレッシュトークンを発行
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // 初回ログイン時にトークンを保存
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at! * 1000;
      }
      // アクセストークンが有効期限内であればそのまま返す
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }
      // 期限切れの場合はリフレッシュ
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
};
```

### 2. トークン管理

#### アクセストークン・リフレッシュトークンの保存方針
| 項目 | 方針 |
|------|------|
| アクセストークン | JWTセッション内（クライアントへは渡さない） |
| リフレッシュトークン | Neon DB の `Account` テーブル（Prisma Adapter が自動管理） |
| 有効期限 | `accessTokenExpires` としてJWT内に記録 |

#### リフレッシュ処理（`lib/auth/refreshAccessToken.ts`）
```typescript
async function refreshAccessToken(token: JWT) {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    });

    const refreshedTokens = await response.json();
    if (!response.ok) throw refreshedTokens;

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      // リフレッシュトークンはローテーションされる場合のみ上書き
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}
```

#### Cron Job でのトークン利用（Phase 2）
- Cron エンドポイントでは `userId` を受け取り、DB から直接 `refreshToken` を取得してアクセストークンを再発行
- Cron はユーザーセッション外で実行されるため、DB 経由のトークン取得が必要

### 3. 保護ルート（ミドルウェア設計）

#### `middleware.ts`
```typescript
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tasks/:path*",
    "/settings/:path*",
    "/api/tasks/:path*",
    "/api/schedule/:path*",
    "/api/calendar/:path*",
    "/api/settings/:path*",
  ],
};
```

#### 保護対象ルート一覧
| パス | 保護レベル |
|------|-----------|
| `/dashboard` | 認証必須 |
| `/tasks/*` | 認証必須 |
| `/settings` | 認証必須 |
| `/api/tasks/*` | 認証必須（セッション検証） |
| `/api/schedule/*` | 認証必須（セッション検証） |
| `/api/calendar/*` | 認証必須（セッション検証） |
| `/api/cron/*` | CRON_SECRET 認証（Phase 2） |

### 4. セッション管理の仕様

#### セッション有効期間
- JWTセッション: デフォルト 30日
- アクセストークン: 約1時間（Googleのデフォルト）
- リフレッシュトークン: 取り消しまで有効

#### セッション型定義拡張（`types/next-auth.d.ts`）
```typescript
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}
```

### 5. APIルート保護の方針

#### サーバーサイドでのセッション取得
```typescript
// app/api/tasks/route.ts の例
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // session.user.id でユーザーを特定してDBアクセス
}
```

#### エラーハンドリング
- `session.error === "RefreshAccessTokenError"` の場合 → フロントエンドで再ログインを促す
- APIルートでセッションがない場合 → 401 を返す

---

## APIインターフェース

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/auth/signin` | GET | GoogleログインページへのリダイレクトURL |
| `/api/auth/callback/google` | GET | OAuth コールバック（NextAuth が自動処理） |
| `/api/auth/signout` | POST | セッション破棄・ログアウト |
| `/api/auth/session` | GET | 現在のセッション情報を返す |

---

## 環境変数

```env
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=<openssl rand -base64 32 で生成>
GOOGLE_CLIENT_ID=<Google Cloud Console から取得>
GOOGLE_CLIENT_SECRET=<Google Cloud Console から取得>
```

---

## 未決事項・考慮点

- [ ] Google Cloud Console でのOAuth同意画面のスコープ申請（本番公開時に必要）
- [ ] リフレッシュトークンのローテーション対応（Googleは一部のケースでローテーションを行う）
- [ ] 複数デバイスからのログインに対するセッション管理方針
- [ ] アカウント削除時のトークン revoke 処理（Google APIで revoke 要求を送る）
- [ ] `access_type: "offline"` と `prompt: "consent"` の組み合わせにより、既存ユーザーも再同意が必要になる点を考慮
