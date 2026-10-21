"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Message = { id: string; role: "user" | "assistant"; content: string };
type ConversationSummary = { id: string; title: string; updatedAt: string };

const SUGGESTIONS = [
  "Me siento ansioso y no sé por qué",
  "Últimamente me cuesta dormir",
  "Estoy triste y sin ganas de nada",
  "Tuve un problema con alguien cercano",
];

// Negritas sencillas (**texto**) sin depender de una librería de markdown.
function renderText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default function Chat() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) setConversations(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la API
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  async function openConversation(id: string) {
    abortRef.current?.abort();
    setSidebarOpen(false);
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setConversationId(id);
    setMessages(data.messages);
  }

  function newConversation() {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }

  async function deleteConversation(id: string) {
    if (!confirm("¿Borrar esta conversación? No se podrá recuperar.")) return;
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (id === conversationId) newConversation();
    loadConversations();
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;

    setInput("");
    setStreaming(true);
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: message },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    const appendToAssistant = (chunk: string) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
      );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        appendToAssistant(data?.error ?? "Perdona, algo salió mal. Inténtalo de nuevo.");
        return;
      }

      const newId = res.headers.get("X-Conversation-Id");
      if (newId && newId !== conversationId) setConversationId(newId);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToAssistant(decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        appendToAssistant("Perdona, se perdió la conexión. Inténtalo de nuevo.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      loadConversations();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Barra lateral */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-border bg-surface transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="h-3 w-3 rounded-full bg-accent" />
          <span className="font-serif text-xl">Calma</span>
        </div>
        <div className="px-3">
          <button
            onClick={newConversation}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            + Nueva conversación
          </button>
        </div>
        <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
          {conversations.length > 0 && (
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Tus conversaciones
            </p>
          )}
          <ul className="space-y-1">
            {conversations.map((c) => (
              <li key={c.id} className="group flex items-center">
                <button
                  onClick={() => openConversation(c.id)}
                  className={`flex-1 truncate rounded-lg px-3 py-2 text-left text-sm transition ${
                    c.id === conversationId ? "bg-accent-soft font-semibold" : "hover:bg-accent-soft/60"
                  }`}
                  title={c.title}
                >
                  {c.title}
                </button>
                <button
                  onClick={() => deleteConversation(c.id)}
                  className="ml-1 rounded-md px-2 py-1 text-muted opacity-0 transition hover:text-red-500 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Borrar conversación"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <p className="border-t border-border px-5 py-4 text-xs leading-relaxed text-muted">
          Calma es una IA de apoyo emocional y no sustituye a un profesional. Si estás en peligro,
          llama a emergencias (911 / 112) o a la línea de crisis de tu país.
        </p>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Área principal */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg px-2 py-1 text-xl"
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <span className="font-serif text-lg">Calma</span>
        </header>

        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-6 text-center">
              <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
                <span className="animate-breathe absolute inset-0 rounded-full bg-accent-soft" />
                <span className="relative h-10 w-10 rounded-full bg-accent" />
              </div>
              <h1 className="font-serif text-3xl md:text-4xl">Hola, estoy aquí para escucharte</h1>
              <p className="mt-3 max-w-md text-muted">
                Cuéntame cómo te sientes hoy. Este es un espacio tranquilo, sin juicios, a tu ritmo.
              </p>
              <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm transition hover:border-accent hover:bg-accent-soft"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-user-bubble px-4 py-3 text-user-text">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-3">
                    <span className="mt-2 h-3 w-3 shrink-0 rounded-full bg-accent" />
                    <div className="max-w-[90%] whitespace-pre-wrap leading-relaxed">
                      {m.content ? (
                        renderText(m.content)
                      ) : (
                        <span className="inline-flex gap-1 py-2" aria-label="Escribiendo">
                          <span className="typing-dot h-2 w-2 rounded-full bg-muted" />
                          <span className="typing-dot h-2 w-2 rounded-full bg-muted [animation-delay:0.2s]" />
                          <span className="typing-dot h-2 w-2 rounded-full bg-muted [animation-delay:0.4s]" />
                        </span>
                      )}
                    </div>
                  </div>
                ),
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto w-full max-w-2xl px-4 pb-4"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm focus-within:border-accent">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Escribe lo que sientes..."
              rows={1}
              maxLength={8000}
              className="max-h-[200px] flex-1 resize-none bg-transparent px-3 py-2 outline-none placeholder:text-muted"
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              className="rounded-xl bg-accent px-4 py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            Enter para enviar · Shift + Enter para nueva línea
          </p>
        </form>
      </main>
    </div>
  );
}
