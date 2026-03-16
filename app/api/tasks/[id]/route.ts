// PATCH  /api/tasks/[id] → タスク更新（部分更新）
// DELETE /api/tasks/[id] → タスク削除

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// PATCH のリクエストボディ（全フィールドが optional = 一部だけ送ってもOK）
const updateTaskSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  deadline: z.string().optional().nullable(),
  estimatedMinutes: z.number().int().min(1).max(59940).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
  progressPct: z.number().int().min(0).max(100).optional(),
});

// ─────────────────────────────────────────────────────────
// PATCH: タスクの部分更新
// ─────────────────────────────────────────────────────────
export async function PATCH(
  req: Request,
  // Next.js 15+ では params が Promise になった
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // 「存在するか」「自分のタスクか」を同時に確認
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = { ...parsed.data };

  // DONE にした場合は進捗を自動的に 100% にセット
  if (data.status === "DONE") {
    data.progressPct = 100;
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...data,
      // deadline は文字列 → Date 変換、または null（締切削除）を処理
      deadline:
        data.deadline !== undefined
          ? data.deadline
            ? new Date(data.deadline)
            : null
          : undefined,
    },
  });

  return Response.json({ task });
}

// ─────────────────────────────────────────────────────────
// DELETE: タスク削除
// ─────────────────────────────────────────────────────────
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.task.delete({ where: { id } });

  // 204 No Content（削除成功、返すボディなし）
  return new Response(null, { status: 204 });
}
