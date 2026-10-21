import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientId } from "@/lib/client-id";

export async function GET(_req: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  const { id } = await ctx.params;
  const clientId = await getClientId();
  const conversation = await prisma.conversation.findFirst({
    where: { id, clientId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true },
      },
    },
  });
  if (!conversation) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  return NextResponse.json(conversation);
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/conversations/[id]">) {
  const { id } = await ctx.params;
  const clientId = await getClientId();
  await prisma.conversation.deleteMany({ where: { id, clientId } });
  return new NextResponse(null, { status: 204 });
}
