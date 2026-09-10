"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChartColumn,
  Activity,
  KeyRound,
  Filter,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";

interface Msg {
  role: "user" | "model";
  text: string;
}

type Mode = "ask" | "do";

const SUGGESTIONS: { icon: typeof Activity; title: string; subtitle: string; prompt: string }[] = [
  { icon: ChartColumn, title: "Resumen semanal", subtitle: "Conversión últimos 7 días", prompt: "Dame un resumen semanal de conversión" },
  { icon: Activity, title: "Estado del tracking", subtitle: "¿Está llegando data?", prompt: "¿Está llegando data a este workspace?" },
  { icon: KeyRound, title: "Mis API keys", subtitle: "Ver claves activas", prompt: "Lista mis API keys activas" },
  { icon: Filter, title: "Mis funnels", subtitle: "Ver definiciones", prompt: "Lista mis funnels" },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 13) return "Buenos días";
  if (h >= 13 && h < 21) return "Buenas tardes";
  return "Buenas noches";
}

export function ChatWidget() {
  const { slug } = useParams<{ slug: string }>();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("ask");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const greet = useMemo(greeting, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    const next: Msg[] = [...messages, { role: "user" as const, text: clean }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, mode, messages: next }),
      });
      if (!res.ok || !res.body) throw new Error(res.status === 401 ? "Sesión expirada" : res.status === 503 ? "Chat no configurado" : "Error del chat");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let modelText = "";
      setMessages((prev) => [...prev, { role: "model", text: "" }]);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const evt = JSON.parse(line.slice(5)) as
            | { t: "text"; d: string }
            | { t: "status"; d: string }
            | { t: "done" }
            | { t: "error"; d: string };
          if (evt.t === "text") {
            modelText += evt.d;
            const snapshot = modelText;
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = { role: "model", text: snapshot };
              return copy;
            });
          } else if (evt.t === "status") {
            const snapshot = `${modelText}\n\n_${evt.d}_`;
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = { role: "model", text: snapshot };
              return copy;
            });
          } else if (evt.t === "error") {
            throw new Error(evt.d);
          }
        }
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "model", text: `⚠️ ${e instanceof Error ? e.message : "Error"}` }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setOpen(true)}
          className="trell-btn-accent !h-12 !w-12 !rounded-full !p-0 shadow-lg"
          aria-label="Abrir Ask Trell"
        >
          <MessageCircle size={18} />
        </button>
      </div>
    );
  }

  return (
    <aside className="trell-drawer-right-in hidden h-full w-[360px] max-w-[calc(100vw-2rem)] shrink-0 flex-col overflow-hidden rounded-xl bg-neutral-100 py-2 pl-2 md:flex dark:bg-[#111111]">
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-trell-line bg-white dark:border-[#2a2a29] dark:bg-[#191918]">
        {/* header */}
        <div className="flex items-center justify-between border-b border-trell-line px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Sparkles size={14} />
            </span>
            <div>
              <div className="text-sm font-semibold leading-none text-trell-ink">Ask Trell</div>
              <div className="mt-0.5 text-[11px] leading-none text-trell-ink-muted">Tus workspaces, en tus palabras</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setMessages([])} className="trell-btn-outline h-8 w-8 !px-0" title="Nueva conversación" aria-label="Nueva conversación">
              <Plus size={14} />
            </button>
            <button onClick={() => setOpen(false)} className="trell-btn-outline h-8 w-8 !px-0" title="Cerrar" aria-label="Cerrar">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="m-auto flex w-full flex-col items-center py-6 text-center">
              <div className="trell-empty-state-icon !mb-3">
                <MessageCircle size={20} />
              </div>
              <div className="text-[15px] font-semibold text-trell-ink">{greet}, ¿en qué te ayudo?</div>
              <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-trell-ink-muted">
                Pregunta por tus métricas, funnels o tracking.
              </p>
              <div className="mt-5 flex w-full flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.title}
                    onClick={() => void send(s.prompt)}
                    className="flex items-center gap-3 rounded-xl border border-trell-line bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:bg-neutral-50 dark:bg-[#1e1e1d] dark:hover:bg-[#242424]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-[#2a2a29] dark:text-[#9a9a99]">
                      <s.icon size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-trell-ink">{s.title}</span>
                      <span className="block truncate text-xs text-trell-ink-muted">{s.subtitle}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => (
                m.role === "user" ? (
                  <div key={i} className="max-w-[90%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-neutral-900 px-3.5 py-2.5 text-sm leading-relaxed text-white dark:bg-[#CDCCCC] dark:text-[#111111]">
                    {m.text}
                  </div>
                ) : (
                  <div key={i} className="max-w-full self-start whitespace-pre-wrap text-sm leading-relaxed text-trell-ink">
                    {m.text || "…"}
                  </div>
                )
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* composer */}
        <div className="border-t border-trell-line p-3">
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Pregunta algo…"
              maxLength={1000}
              className="trell-input h-9 flex-1"
            />
            <button
              onClick={() => void send(input)}
              disabled={busy || !input.trim()}
              className="trell-btn-accent h-9 w-9 shrink-0 !px-0 !rounded-full disabled:opacity-40"
              aria-label="Enviar"
            >
              <Send size={14} />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-trell-ink-muted">
              {mode === "ask" ? "Responde preguntas" : "Ejecuta acciones"}
            </span>
            <button
              onClick={() => setMode((m) => (m === "ask" ? "do" : "ask"))}
              className="trell-btn-outline h-7 gap-1 px-2.5 text-[11px]"
              title={mode === "ask" ? "Cambiar a modo Do (ejecuta acciones)" : "Cambiar a modo Ask (solo responde)"}
            >
              ✎ {mode === "ask" ? "Ask" : "Do"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
