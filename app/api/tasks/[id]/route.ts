import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateTaskSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  estimatedMinutes: z.number().int().min(1).max(1440).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
  progressPct: z.number().int().min(0).max(100).optional(),
});

async function getTaskOrFail(id: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.userId !== userId) return null;
  return task;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await getTaskOrFail(id, session.user.id);
  if (!task) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({ task });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getTaskOrFail(id, session.user.id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const result = updateTaskSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: result.error.flatten() }, { status: 400 });
  }

  const data = result.data;

  // DONE に変更した場合は progressPct を 100 に自動セット
  if (data.status === "DONE") {
    data.progressPct = 100;
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...data,
      deadline: data.deadline !== undefined ? (data.deadline ? new Date(data.deadline) : null) : undefined,
    },
  });

  return Response.json({ task });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getTaskOrFail(id, session.user.id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.task.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
