// GET /api/tasks  → タスク一覧取得
// POST /api/tasks → タスク新規作成

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// POST のリクエストボディを検証するスキーマ（zod）
const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, "タスク名は必須です")
    .max(100, "100文字以内で入力してください"),
  description: z.string().max(1000).optional(),
  // deadline は ISO 文字列で受け取る（フロントで new Date().toISOString() して送る）
  deadline: z.string().optional(),
  estimatedMinutes: z
    .number()
    .int()
    .min(1, "1分以上で入力してください")
    .max(1440, "24時間（1440分）以内で入力してください"),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

// ─────────────────────────────────────────────────────────
// GET: ログインユーザーのタスク一覧を取得
// ─────────────────────────────────────────────────────────
export async function GET(req: Request) {
  // セッション確認（未ログインなら 401 を返す）
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // URL のクエリパラメータを取得（例: /api/tasks?status=PENDING）
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");

  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      // status や priority が指定された場合のみ絞り込む
      ...(status && { status: status as any }),
      ...(priority && { priority: priority as any }),
    },
    orderBy: [
      // 締切が近い順 → 優先度が高い順 → 作成が新しい順
      { deadline: "asc" },
      { priority: "asc" }, // Prisma の enum ソートは文字列順のため要注意
      { createdAt: "desc" },
    ],
  });

  return Response.json({ tasks });
}

// ─────────────────────────────────────────────────────────
// POST: タスクを新規作成
// ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // zod でバリデーション
  // safeParse は例外を投げず、success / error を返す
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    // バリデーション失敗 → フィールドごとのエラーを返す
    return Response.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
      estimatedMinutes: parsed.data.estimatedMinutes,
      priority: parsed.data.priority,
    },
  });

  // 201 Created でタスクを返す
  return Response.json({ task }, { status: 201 });
}
