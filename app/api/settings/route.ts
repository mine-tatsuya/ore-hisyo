import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSettingsSchema = z.object({
  wakeUpTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  bedTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  lunchStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  lunchEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  focusTimeStart: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  focusTimeEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  aiPersonality: z.enum(["STRICT", "BALANCED", "RELAXED"]).optional(),
  aiCustomPrompt: z.string().max(500).optional().nullable(),
  calendarMode: z.enum(["AUTO", "MANUAL"]).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.settings.findUnique({
    where: { userId: session.user.id },
  });

  if (!settings) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({ settings });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const result = updateSettingsSchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: result.error.flatten() }, { status: 400 });
  }

  const settings = await prisma.settings.upsert({
    where: { userId: session.user.id },
    update: result.data,
    create: { userId: session.user.id, ...result.data },
  });

  return Response.json({ settings });
}
