"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChartColumn,
  Activity,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Filter,
  MessageCircle,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";

interface Msg {
  role: "user" | "model";
  text: string;
}

interface Convo {
  id: string;
  title: string;
  updatedAt: number;
  messages: Msg[];
}

type Mode = "ask" | "do";

const SUGGESTIONS: { icon: typeof Activity; title: string; subtitle: string; prompt: string }[] = [
  { icon: ChartColumn, title: "Resumen semanal", subtitle: "Conversión últimos 7 días", prompt: "Dame un resumen semanal de conversión" },
  { icon: Activity, title: "Estado del tracking", subtitle: "¿Está llegando data?", prompt: "¿Está llegando data a este workspace?" },
  { icon: KeyRound, title: "Mis API keys", subtitle: "Ver claves activas", prompt: "Lista mis API keys activas" },
  { icon: Filter, title: "Mis funnels", subtitle: "Ver definiciones", prompt: "Lista mis funnels" },
];

const CHAT_KEY = (slug: string) => `trell:chat:${slug}`;
const MAX_CONVOS = 20;
const MAX_MSGS = 60;

function loadConvos(slug: string): Convo[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(CHAT_KEY(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Convo[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages))
      .slice(0, MAX_CONVOS);
  } catch {
    return [];
  }
}

function ago(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

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
  const [convos, setConvos] = useState<Convo[]>(() => (slug ? loadConvos(slug) : []));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const greet = useMemo(greeting, []);

  // Reload history when switching workspaces.
  useEffect(() => {
    setConvos(slug ? loadConvos(slug) : []);
    setActiveId(null);
    setMessages([]);
    setHistoryOpen(false);
    setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Persist the open conversation.
  useEffect(() => {
    if (!slug) return;
    if (messages.length === 0) return;
    if (!activeId) {
      setActiveId(`c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`);
      return;
    }
    setConvos((prev) => {
      const title =
        prev.find((c) => c.id === activeId)?.title ??
        [...messages].find((m) => m.role === "user")?.text.slice(0, 42) ??
        "Conversación";
      const rest = prev.filter((c) => c.id !== activeId);
      const next: Convo = { id: activeId, title, updatedAt: Date.now(), messages: messages.slice(-MAX_MSGS) };
      const merged = [next, ...rest].slice(0, MAX_CONVOS);
      try {
        localStorage.setItem(CHAT_KEY(slug), JSON.stringify(merged));
      } catch {
        // storage full or unavailable — chat still works in memory
      }
      return merged;
    });
  }, [messages, activeId, slug]);

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setHistoryOpen(false);
    setQuery("");
  }

  function openConvo(id: string) {
    const found = convos.find((c) => c.id === id);
    if (!found) return;
    setActiveId(found.id);
    setMessages(found.messages);
    setHistoryOpen(false);
    setQuery("");
  }

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
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06)] dark:bg-[#191918] dark:shadow-none dark:ring-1 dark:ring-white/10">
        {/* header */}
        <div className="relative flex items-center justify-between border-b border-trell-line px-4 py-3">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex items-center gap-1 text-[15px] font-semibold text-trell-ink"
            title="Ver conversaciones"
            aria-expanded={historyOpen}
          >
            Nueva conversación <ChevronDown size={14} className={`text-neutral-400 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
          </button>
          <div className="flex items-center gap-1">
            <button onClick={newChat} className="trell-btn-outline h-8 w-8 !px-0" title="Nueva conversación" aria-label="Nueva conversación">
              <Plus size={14} />
            </button>
            <button onClick={() => { setOpen(false); setHistoryOpen(false); }} className="trell-btn-outline h-8 w-8 !px-0" title="Cerrar" aria-label="Cerrar">
              <X size={14} />
            </button>
          </div>

          {historyOpen && (
            <div className="absolute inset-x-3 top-full z-20 mt-2 overflow-hidden rounded-xl border border-trell-line bg-white shadow-[0_20px_50px_-16px_rgb(24_24_27/0.25)] dark:border-[#2a2a29] dark:bg-[#1e1e1d]">
              <div className="border-b border-trell-line p-2 dark:border-[#2a2a29]">
                <div className="flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 dark:bg-[#111111]">
                  <Search size={13} className="shrink-0 text-neutral-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar…"
                    className="w-full bg-transparent text-[13px] text-trell-ink placeholder:text-neutral-400 focus:outline-none"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {(() => {
                  const q = query.trim().toLowerCase();
                  const filtered = convos.filter((c) => !q || c.title.toLowerCase().includes(q));
                  if (filtered.length === 0) {
                    return <p className="px-3 py-4 text-center text-xs text-trell-ink-muted">Sin conversaciones todavía.</p>;
                  }
                  const week = 7 * 24 * 3600 * 1000;
                  const now = Date.now();
                  const recent = filtered.filter((c) => now - c.updatedAt < week);
                  const older = filtered.filter((c) => now - c.updatedAt >= week);
                  const row = (c: Convo) => (
                    <button
                      key={c.id}
                      onClick={() => openConvo(c.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-[#262625] ${
                        c.id === activeId ? "bg-neutral-100 dark:bg-[#262625]" : ""
                      }`}
                    >
                      <span className="min-w-0 truncate text-[13px] text-trell-ink">{c.title}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-neutral-400">{ago(c.updatedAt)}</span>
                    </button>
                  );
                  return (
                    <>
                      {recent.map(row)}
                      {recent.length > 0 && older.length > 0 && (
                        <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                          Anteriores
                        </div>
                      )}
                      {older.map(row)}
                    </>
                  );
                })()}
              </div>
              <div className="border-t border-trell-line p-2 dark:border-[#2a2a29]">
                <button
                  onClick={newChat}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-trell-line px-3 py-2 text-[13px] font-medium text-trell-ink transition-colors hover:bg-neutral-50 dark:hover:bg-[#262625]"
                >
                  <Plus size={14} /> Nueva conversación
                </button>
              </div>
            </div>
          )}
        </div>

        {/* body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="m-auto flex w-full flex-col items-center py-6 text-center">
              <div className="relative mb-4">
                <div className="absolute inset-0 scale-125 rounded-2xl bg-blue-600/20 blur-xl" aria-hidden />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-[#4d88f5] to-[#2563eb] text-white shadow-[0_8px_20px_-6px_rgb(37_99_235/0.5)]">
                  <Sparkles size={22} />
                </div>
              </div>
              <div className="text-[17px] font-semibold tracking-tight text-trell-ink">{greet}, ¿en qué te ayudo?</div>
              <p className="mt-1 max-w-[250px] text-xs leading-relaxed text-trell-ink-muted">
                Pregunta por tus métricas, funnels o tracking.
              </p>
              <div className="mt-5 flex w-full flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.title}
                    onClick={() => void send(s.prompt)}
                    className="group flex items-center gap-3 rounded-xl border border-trell-line bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:-translate-y-px hover:border-blue-200 hover:shadow-[0_6px_16px_-8px_rgb(37_99_235/0.35)] dark:bg-[#1e1e1d] dark:hover:border-blue-900 dark:hover:bg-[#242424]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                      <s.icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-trell-ink">{s.title}</span>
                      <span className="block truncate text-xs text-trell-ink-muted">{s.subtitle}</span>
                    </span>
                    <ChevronRight size={14} className="shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-neutral-600" />
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
              className="trell-input h-9 min-w-0 flex-1"
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
