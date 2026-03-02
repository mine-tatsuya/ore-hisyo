import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "俺秘書",
  description: "AIがあなたの1日を最適化するスケジュール管理アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {/* Providers で全ページを囲むことで、どのページでも useSession() が使える */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
