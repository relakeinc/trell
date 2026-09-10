"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";

interface Msg {
  role: "user" | "model";
  text: string;
}

const SUGGESTIONS = ["¿Cómo van mis workspaces?", "¿Está llegando data?", "Dame un resumen semanal"];

export function ChatWidget() {
  const { slug } = useParams<{ slug: string }>();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

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
        body: JSON.stringify({ slug, messages: next }),
      });
      if (!res.ok || !res.body) throw new Error(res.status === 401 ? "Sesión expirada" : "Error del chat");
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
            const snapshot = modelText + `\n\n_${evt.d}_`;
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

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[480px] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-trell-line bg-white shadow-[0_20px_50px_-16px_rgb(24_24_27/0.25)] dark:border-[#2a2a29] dark:bg-[#191918]">
          <div className="flex items-center justify-between border-b border-trell-line px-4 py-3 dark:border-[#2a2a29]">
            <div>
              <div className="text-sm font-semibold text-trell-ink">Ask Trell</div>
              <div className="text-xs text-trell-ink-muted">Tus workspaces, en tus palabras</div>
            </div>
            <button onClick={() => setOpen(false)} className="trell-btn-outline h-8 w-8 !px-0" aria-label="Cerrar chat">
              <X size={14} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-trell-ink-muted">Pregúntame por tus métricas, funnels o tracking.</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="rounded-lg border border-trell-line px-3 py-2 text-left text-xs text-trell-ink transition-colors hover:bg-neutral-50 dark:hover:bg-[#1e1e1d]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "self-end bg-blue-600 text-white"
                    : "self-start border border-trell-line bg-neutral-50 text-trell-ink dark:bg-[#1e1e1d]"
                }`}
              >
                {m.text || "…"}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t border-trell-line p-3 dark:border-[#2a2a29]"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta algo…"
              maxLength={1000}
              className="trell-input h-9 flex-1"
            />
            <button type="submit" disabled={busy || !input.trim()} className="trell-btn-accent h-9 w-9 !px-0 disabled:opacity-40" aria-label="Enviar">
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="trell-btn-accent !h-12 !w-12 !rounded-full !p-0 shadow-lg"
        aria-label={open ? "Cerrar Ask Trell" : "Abrir Ask Trell"}
      >
        {open ? <X size={18} /> : <MessageCircle size={18} />}
      </button>
    </div>
  );
}
