// GET /api/recurring-tasks  → ユーザーの定期タスク一覧を取得
// POST /api/recurring-tasks → 新規定期タスクを作成
//
// 「定期タスク」とは：毎日・毎週・N日ごと・毎月 繰り返すタスクのことです。
// 家事（洗濯・掃除）や運動など、「期日はないが定期的にやること」を管理します。
// Gemini のスケジュール生成にも自動で組み込まれます。

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { NextRequest } from "next/server";

// ── バリデーションスキーマ ──
// Zod を使って「正しい形式のデータが来ているか」チェックします。
// フロントエンドでも同じ Zod スキーマを使うことでバリデーションを共有できます。
const createSchema = z.object({
  title: z
    .string()
    .min(1, "タスク名を入力してください")
    .max(100, "100文字以内で入力してください"),
  description: z.string().max(1000).optional(),
  estimatedMinutes: z
    .number()
    .int()
    .min(1, "1分以上で入力してください")
    .max(1440, "最大24時間（1440分）まで設定できます"),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  isActive: z.boolean().default(true),

  // 繰り返しパターン
  recurrenceType: z.enum(["DAILY", "WEEKLY", "INTERVAL", "MONTHLY"]),
  daysOfWeek: z.string().optional(),     // WEEKLY: JSON配列 "[1,3,5]"
  intervalDays: z.number().int().min(1).max(365).optional(), // INTERVAL: 何日ごとか
  dayOfMonth: z.number().int().min(1).max(31).optional(),    // MONTHLY: 何日か
  startDate: z.string().datetime().optional(), // INTERVAL の基準日

  // 希望時間帯
  preferredTimeType: z.enum(["MORNING", "NOON", "EVENING", "SPECIFIC"]).optional(),
  preferredStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), // "HH:MM"
});

// ── GET: 一覧取得 ──
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const userId = session.user.id;

  // クエリパラメータ ?active=true で絞り込み可能
  const activeParam = req.nextUrl.searchParams.get("active");

  const recurringTasks = await prisma.recurringTask.findMany({
    where: {
      userId,
      // active=false の場合は非アクティブも含め全件、それ以外はアクティブのみ
      ...(activeParam === "false" ? {} : { isActive: true }),
    },
    orderBy: [
      { priority: "asc" }, // HIGH → MEDIUM → LOW の順（辞書順）
      { createdAt: "desc" },
    ],
  });

  return Response.json({ recurringTasks });
}

// ── POST: 新規作成 ──
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSONの形式が不正です" }, { status: 400 });
  }

  // バリデーション
  const result = createSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "入力形式が不正です", errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = result.data;

  // ── 繰り返しタイプ別のバリデーション ──
  // recurrenceType によって必須フィールドが変わるため、ここで追加チェックします
  if (data.recurrenceType === "WEEKLY" && !data.daysOfWeek) {
    return Response.json({ error: "WEEKLY の場合は daysOfWeek が必要です" }, { status: 400 });
  }
  if (data.recurrenceType === "INTERVAL" && !data.intervalDays) {
    return Response.json({ error: "INTERVAL の場合は intervalDays が必要です" }, { status: 400 });
  }
  if (data.recurrenceType === "MONTHLY" && !data.dayOfMonth) {
    return Response.json({ error: "MONTHLY の場合は dayOfMonth が必要です" }, { status: 400 });
  }
  if (data.preferredTimeType === "SPECIFIC" && !data.preferredStartTime) {
    return Response.json({ error: "SPECIFIC の場合は preferredStartTime が必要です" }, { status: 400 });
  }

  const recurringTask = await prisma.recurringTask.create({
    data: {
      userId,
      title:             data.title,
      description:       data.description,
      estimatedMinutes:  data.estimatedMinutes,
      priority:          data.priority,
      isActive:          data.isActive,
      recurrenceType:    data.recurrenceType,
      daysOfWeek:        data.daysOfWeek,
      intervalDays:      data.intervalDays,
      dayOfMonth:        data.dayOfMonth,
      // startDate が未指定の場合は現在時刻（Prisma の @default(now()) に任せる）
      ...(data.startDate ? { startDate: new Date(data.startDate) } : {}),
      preferredTimeType: data.preferredTimeType,
      preferredStartTime: data.preferredStartTime,
    },
  });

  return Response.json({ recurringTask }, { status: 201 });
}
