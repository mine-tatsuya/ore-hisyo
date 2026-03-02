// TypeScript に「Session と JWT には accessToken などの独自フィールドがある」と教えるファイル
// .d.ts = 型定義ファイル（実行コードは含まない）

import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;  // Google Calendar API を呼ぶのに使う
    error?: string;        // リフレッシュトークンエラー時のフラグ
    user: {
      id: string;          // DB の User.id（タスク取得などに使う）
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
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
