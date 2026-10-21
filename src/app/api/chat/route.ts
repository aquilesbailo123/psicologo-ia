import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientId } from "@/lib/client-id";
import { anthropic, MODEL, SYSTEM_PROMPT } from "@/lib/claude";

const MAX_MESSAGE_LENGTH = 8000;

const REFUSAL_TEXT =
  "Lo siento, no puedo ayudarte con eso en este momento. Si estás pasando por un momento difícil o estás en peligro, por favor contacta a los servicios de emergencia de tu país o a una línea de ayuda en crisis. Aquí sigo para escucharte.";

export async function POST(req: Request) {
  const clientId = await getClientId();
  const body = (await req.json().catch(() => null)) as {
    conversationId?: string;
    message?: string;
  } | null;

  const message = body?.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "El mensaje está vacío" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "El mensaje es demasiado largo" }, { status: 400 });
  }

  let conversation = body?.conversationId
    ? await prisma.conversation.findFirst({ where: { id: body.conversationId, clientId } })
    : null;
  if (body?.conversationId && !conversation) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { clientId, title: message.slice(0, 60) },
    });
  }

  await prisma.message.create({
    data: { conversationId: conversation.id, role: "user", content: message },
  });

  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const conversationId = conversation.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = "";
      try {
        const claudeStream = anthropic.beta.messages.stream(
          {
            model: MODEL,
            max_tokens: 16000,
            output_config: { effort: "medium" },
            system: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
            // Si los filtros de seguridad rechazan la petición, la API la reintenta en otro modelo.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            messages,
          },
          { signal: req.signal },
        );

        for await (const event of claudeStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            reply += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        const final = await claudeStream.finalMessage();
        if (final.stop_reason === "refusal") {
          // Un rechazo a mitad de respuesta deja texto parcial: se descarta y se reemplaza.
          const prefix = reply ? "\n\n" : "";
          reply = REFUSAL_TEXT;
          controller.enqueue(encoder.encode(prefix + REFUSAL_TEXT));
        }
      } catch (err) {
        if (req.signal.aborted) {
          controller.close();
          return;
        }
        console.error("Error llamando a Claude:", err);
        const text =
          err instanceof Anthropic.RateLimitError
            ? "\n\nHay muchas personas conversando ahora mismo. Inténtalo de nuevo en unos segundos."
            : "\n\nPerdona, tuve un problema para responder. ¿Puedes intentarlo de nuevo?";
        controller.enqueue(encoder.encode(text));
      }

      if (reply) {
        await prisma.message.create({
          data: { conversationId, role: "assistant", content: reply },
        });
      }
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Conversation-Id": conversationId,
    },
  });
}
