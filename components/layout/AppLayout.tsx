"use client";
// useState はクライアント側の機能なので "use client" が必要

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";

interface AppLayoutProps {
  children: React.ReactNode;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function AppLayout({ children, user }: AppLayoutProps) {
  // サイドバーの開閉状態（trueで開いている）
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // モバイル用ドロワーの開閉状態
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    // 全体を横並びにして画面全体を使う
    <div className="flex h-screen overflow-hidden bg-[#EEF1FA]">

      {/* ========== モバイル用オーバーレイ ========== */}
      {/* ドロワーが開いているときだけ表示。クリックでドロワーを閉じる */}
      {/* md:hidden = 768px以上では非表示 */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* ========== 左：サイドバー ========== */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
        user={user}
      />

      {/* ========== 右：メインコンテンツエリア ========== */}
      {/* min-w-0: flex子要素がはみ出さないようにする */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ヘッダー */}
        <TopNav user={user} onMobileOpen={() => setIsMobileOpen(true)} />

        {/* コンテンツ（スクロール可能） */}
        <main className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
          {/* max-w-4xl: コンテンツ幅を最大896pxに制限（読みやすさのため） */}
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
