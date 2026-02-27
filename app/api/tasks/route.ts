import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createTaskSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  deadline: z.string().datetime().optional().nullable(),
  estimatedMinutes: z.number().int().min(1).max(1440),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const sort = searchParams.get("sort") ?? "deadline_asc";

  const orderBy = (() => {
    switch (sort) {
      case "priority_desc": return [{ priority: "desc" as const }, { deadline: "asc" as const }];
      case "created_desc": return [{ createdAt: "desc" as const }];
      default: return [{ deadline: "asc" as const }, { priority: "desc" as const }];
    }
  })();

  const tasks = await prisma.task.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status: status as never } : {}),
      ...(priority ? { priority: priority as never } : {}),
    },
    orderBy,
  });

  return Response.json({ tasks });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const result = createTaskSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: result.error.flatten() }, { status: 400 });
  }

  const { title, description, deadline, estimatedMinutes, priority } = result.data;

  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title,
      description,
      deadline: deadline ? new Date(deadline) : null,
      estimatedMinutes,
      priority,
    },
  });

  return Response.json({ task }, { status: 201 });
}
