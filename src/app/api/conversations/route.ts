import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientId } from "@/lib/client-id";

export async function GET() {
  const clientId = await getClientId();
  const conversations = await prisma.conversation.findMany({
    where: { clientId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });
  return NextResponse.json(conversations);
}
