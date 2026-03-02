// サーバーコンポーネント（"use client" なし）
// getServerSession はサーバー側でのみ動く関数

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // サーバー側でセッション（ログイン情報）を取得
  // これにより、ページのHTMLを生成する前にログイン確認ができる
  const session = await getServerSession(authOptions);

  // ログインしていなければ /signin に飛ばす（proxy.ts の二重チェック）
  if (!session?.user) {
    redirect("/signin");
  }

  return (
    // AppLayout に user 情報を渡す
    // session.user には name, email, image, id が入っている
    <AppLayout user={session.user}>
      {children}
    </AppLayout>
  );
}
