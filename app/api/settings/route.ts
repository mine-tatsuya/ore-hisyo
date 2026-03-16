// 設定API
// GET /api/settings  → 設定を取得（初回は自動でデフォルト作成）
// PUT /api/settings  → 設定を保存

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { NextRequest } from "next/server";

// 保存できる設定値のバリデーションスキーマ
const settingsSchema = z.object({
  wakeUpTime:      z.string().regex(/^\d{2}:\d{2}$/, "HH:MM形式で入力してください"),
  bedTime:         z.string().regex(/^\d{2}:\d{2}$/, "HH:MM形式で入力してください"),
  lunchStart:      z.string().regex(/^\d{2}:\d{2}$/, "HH:MM形式で入力してください"),
  lunchEnd:        z.string().regex(/^\d{2}:\d{2}$/, "HH:MM形式で入力してください"),
  // 任意項目は空文字 "" も許容（ユーザーが削除したとき）
  focusTimeStart:  z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).optional(),
  focusTimeEnd:    z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).optional(),
  aiPersonality:   z.enum(["STRICT", "BALANCED", "RELAXED"]),
  aiCustomPrompt:  z.string().max(500).optional(),
  calendarMode:    z.enum(["MANUAL", "AUTO"]),
  location:        z.string().max(100).default(""),
  // Cron 設定（calendarMode = AUTO のときのみ使用）
  cronTime:         z.string().regex(/^\d{2}:00$/, "HH:00形式で入力してください").default("12:00"),
  cronTargetOffset: z.number().int().min(0).max(7).default(1),
});

// ---- GET ----
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // upsert: 設定が存在すれば取得、なければデフォルト値で新規作成
  // 「初回ログイン時に自動生成」を API 側で行う（遅延初期化パターン）
  const settings = await prisma.settings.upsert({
    where:  { userId },
    update: {},  // 既存レコードがある場合は何も更新しない（取得のみ）
    create: {
      userId,
      // スキーマの @default() と同じ値を明示して、意図を明確にする
      wakeUpTime:    "07:00",
      bedTime:       "23:00",
      lunchStart:    "12:00",
      lunchEnd:      "13:00",
      aiPersonality:    "BALANCED",
      calendarMode:     "MANUAL",   // ← 初期値はマニュアルモード
      location:         "",
      cronTime:         "12:00",
      cronTargetOffset: 1,
    },
  });

  return Response.json({ settings });
}

// ---- PUT ----
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json();

  // バリデーション
  const result = settingsSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "入力値が不正です", issues: result.error.flatten() },
      { status: 400 }
    );
  }

  const data = result.data;

  // 空文字 "" はDBに null として保存する（任意項目の削除）
  const settings = await prisma.settings.upsert({
    where:  { userId },
    update: {
      ...data,
      focusTimeStart: data.focusTimeStart || null,
      focusTimeEnd:   data.focusTimeEnd   || null,
      aiCustomPrompt: data.aiCustomPrompt || null,
      location:       data.location ?? "",
    },
    create: {
      userId,
      ...data,
      focusTimeStart: data.focusTimeStart || null,
      focusTimeEnd:   data.focusTimeEnd   || null,
      aiCustomPrompt: data.aiCustomPrompt || null,
      location:       data.location ?? "",
    },
  });

  return Response.json({ settings });
}
