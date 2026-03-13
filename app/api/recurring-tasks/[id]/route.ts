// PATCH /api/recurring-tasks/[id] → 更新
// DELETE /api/recurring-tasks/[id] → 削除
//
// [id] は Next.js の動的ルートセグメントです。
// URL が /api/recurring-tasks/abc123 の場合、params.id = "abc123" になります。

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { NextRequest } from "next/server";

// PATCH 用スキーマ（全フィールドをオプションにする）
// すべて optional にすることで「一部だけ更新」ができる（PATCH の設計思想）
const patchSchema = z.object({
  title:             z.string().min(1).max(100).optional(),
  description:       z.string().max(1000).nullable().optional(),
  estimatedMinutes:  z.number().int().min(1).max(1440).optional(),
  priority:          z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  isActive:          z.boolean().optional(),
  recurrenceType:    z.enum(["DAILY", "WEEKLY", "INTERVAL", "MONTHLY"]).optional(),
  daysOfWeek:        z.string().nullable().optional(),
  intervalDays:      z.number().int().min(1).max(365).nullable().optional(),
  dayOfMonth:        z.number().int().min(1).max(31).nullable().optional(),
  startDate:         z.string().datetime().optional(),
  preferredTimeType: z.enum(["MORNING", "NOON", "EVENING", "SPECIFIC"]).nullable().optional(),
  preferredStartTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

// ── PATCH: 更新 ──
// Next.js 16 では params が Promise になったため await が必要
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const userId = session.user.id;
  const { id } = await params;

  // ── 所有者チェック ──
  // 他のユーザーのタスクを更新できないよう、userId も条件に含めます
  const existing = await prisma.recurringTask.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return Response.json({ error: "定期タスクが見つかりません" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSONの形式が不正です" }, { status: 400 });
  }

  const result = patchSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "入力形式が不正です", errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = result.data;

  // startDate の型変換（文字列 → Date）
  const updateData = {
    ...data,
    ...(data.startDate ? { startDate: new Date(data.startDate) } : {}),
  };
  // startDate の文字列版は Prisma には渡さない（型エラー防止）
  delete (updateData as { startDate?: unknown }).startDate;
  if (data.startDate) {
    (updateData as { startDate: Date }).startDate = new Date(data.startDate);
  }

  const recurringTask = await prisma.recurringTask.update({
    where: { id },
    data: updateData,
  });

  return Response.json({ recurringTask });
}

// ── DELETE: 削除 ──
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const userId = session.user.id;
  const { id } = await params;

  // 所有者チェック（自分のタスクのみ削除可能）
  const existing = await prisma.recurringTask.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return Response.json({ error: "定期タスクが見つかりません" }, { status: 404 });
  }

  await prisma.recurringTask.delete({ where: { id } });

  return Response.json({ success: true });
}
