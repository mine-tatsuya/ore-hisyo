// proxy.ts（Next.js 16 から middleware.ts に代わる新しい名前）
// すべてのリクエストに対して「最初に」実行されるファイルです
// ここで「ログインしていないユーザーを /signin に飛ばす」処理をします

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
  // JWTトークンを確認してログイン済みかチェック
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = !!token; // token があればログイン済み
  const pathname = request.nextUrl.pathname;

  // 保護対象のパス（未ログインならアクセスを弾く）
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/schedule") ||
    pathname.startsWith("/api/tasks") ||
    pathname.startsWith("/api/schedule") ||
    pathname.startsWith("/api/calendar") ||
    pathname.startsWith("/api/settings");

  if (isProtected && !isAuthenticated) {
    // 未ログインで保護ページにアクセスしようとしたら /signin へリダイレクト
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  // 問題なければそのまま通す
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tasks/:path*",
    "/settings/:path*",
    "/schedule/:path*",
    "/api/tasks/:path*",
    "/api/schedule/:path*",
    "/api/calendar/:path*",
    "/api/settings/:path*",
  ],
};
