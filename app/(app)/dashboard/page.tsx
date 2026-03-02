// ダッシュボードページ
// サーバーコンポーネント: "use client" なし
// → Prisma を直接呼び出してDBからデータを取得できる
// → クライアントに JS を送らないので高速に表示できる

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { Sparkles, ListTodo, ChevronRight } from "lucide-react";
import Link from "next/link";
import TaskStatusBadge from "@/components/tasks/TaskStatusBadge";

export default async function DashboardPage() {
  // セッションからログイン中のユーザーIDを取得
  // getServerSession: サーバーコンポーネントで session を取得する方法
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  // userId がなければ空データを返す（proxy.ts で認証済みのはずだが念のため）
  if (!userId) {
    return <div className="pt-2 text-sm text-slate-400">セッションエラー</div>;
  }

  // ----- DBからデータ取得（並列で実行して高速化）-----
  // Promise.all: 複数の非同期処理を同時に実行する
  // 順番に実行すると A待ち → B待ち → ... となるが、並列なら全部同時に実行される

  const today = new Date();
  today.setHours(0, 0, 0, 0); // 今日の 00:00:00

  const [pendingCount, inProgressCount, doneToday, recentTasks] =
    await Promise.all([
      // 未着手タスクの件数
      prisma.task.count({
        where: { userId, status: "PENDING" },
      }),
      // 進行中タスクの件数
      prisma.task.count({
        where: { userId, status: "IN_PROGRESS" },
      }),
      // 今日完了したタスクの件数（updatedAt が今日以降）
      prisma.task.count({
        where: {
          userId,
          status: "DONE",
          updatedAt: { gte: today },
        },
      }),
      // 直近タスク（最大5件、作成日時の降順）
      prisma.task.findMany({
        where: {
          userId,
          status: { notIn: ["DONE", "CANCELLED"] },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  return (
    <div className="space-y-4 pt-2">

      {/* ========== サマリーカード（3列グリッド）========== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            未着手タスク
          </p>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {pendingCount}
          </p>
          <p className="text-xs text-slate-400 mt-1">件</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            進行中
          </p>
          <p className="text-3xl font-bold text-[#0052FF] mt-2">
            {inProgressCount}
          </p>
          <p className="text-xs text-slate-400 mt-1">件</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            完了（今日）
          </p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">
            {doneToday}
          </p>
          <p className="text-xs text-slate-400 mt-1">件</p>
        </div>
      </div>

      {/* ========== 今日のスケジュール ========== */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-slate-800">今日のスケジュール</h2>
          <Link
            href="/schedule"
            className="flex items-center gap-1.5 bg-[#0052FF] text-white text-xs font-medium px-3.5 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            スケジュール生成
          </Link>
        </div>

        {/* 空状態（スケジュールはStep 6で実装）*/}
        <div className="flex flex-col items-center justify-center py-12 text-slate-300">
          <Sparkles className="w-10 h-10 mb-3 stroke-1" />
          <p className="text-sm font-medium text-slate-400">
            スケジュールはまだ生成されていません
          </p>
          <p className="text-xs text-slate-300 mt-1">
            「スケジュール生成」ボタンを押して始めましょう
          </p>
        </div>
      </div>

      {/* ========== 直近タスク ========== */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-white/60">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-slate-800">進行中・未着手タスク</h2>
          <Link
            href="/tasks"
            className="text-xs text-[#0052FF] hover:underline flex items-center gap-0.5"
          >
            すべて見る <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {recentTasks.length === 0 ? (
          /* 空状態 */
          <div className="flex flex-col items-center justify-center py-10 text-slate-300">
            <ListTodo className="w-10 h-10 mb-3 stroke-1" />
            <p className="text-sm font-medium text-slate-400">タスクがありません</p>
            <p className="text-xs text-slate-300 mt-1">
              タスク一覧から追加できます
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTasks.map((task) => (
              <Link
                key={task.id}
                href="/tasks"
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                {/* 優先度ドット */}
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    task.priority === "HIGH"
                      ? "bg-rose-500"
                      : task.priority === "MEDIUM"
                      ? "bg-yellow-400"
                      : "bg-slate-300"
                  }`}
                />
                {/* タイトル */}
                <span className="flex-1 text-xs font-medium text-slate-700 group-hover:text-[#0052FF] transition-colors truncate">
                  {task.title}
                </span>
                {/* ステータスバッジ */}
                <TaskStatusBadge status={task.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
