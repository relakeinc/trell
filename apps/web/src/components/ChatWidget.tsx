"use client";

import { useParams } from "next/navigation";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
  ChartColumn,
  Activity,
  ChevronDown,
  FastForward,
  KeyRound,
  Filter,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChat } from "./ChatProvider";
import { ChatContainerContent, ChatContainerRoot, ChatContainerScrollAnchor } from "@/components/ui/chat-container";
import {
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { ScrollButton } from "@/components/ui/scroll-button";
import { Tool } from "@/components/ui/tool";

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

interface ToolCall {
  id: number;
  name: string;
  state: "input-available" | "output-available" | "output-error";
}

type Mode = "ask" | "do";

const SUGGESTIONS: { icon: typeof Activity; title: string; subtitle: string; prompt: string }[] = [
  { icon: ChartColumn, title: "Weekly summary", subtitle: "Last 7 days conversion", prompt: "Give me a weekly conversion summary" },
  { icon: Activity, title: "Tracking status", subtitle: "Is data coming in?", prompt: "Is data coming into this workspace?" },
  { icon: KeyRound, title: "My API keys", subtitle: "View active keys", prompt: "List my active API keys" },
  { icon: Filter, title: "My funnels", subtitle: "View definitions", prompt: "List my funnels" },
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
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 13) return "Good morning.";
  if (h >= 13 && h < 21) return "Good afternoon.";
  return "Good evening.";
}

export function ChatWidget() {
  const { slug } = useParams<{ slug: string }>();
  const { open, setOpen, askHover } = useChat();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("ask");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [modeOpen, setModeOpen] = useState(false);  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [convos, setConvos] = useState<Convo[]>(() => (slug ? loadConvos(slug) : []));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [query, setQuery] = useState("");
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
        "Conversation";
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
    setToolCalls([]);
    setHistoryOpen(false);
    setQuery("");
  }

  function openConvo(id: string) {
    const found = convos.find((c) => c.id === id);
    if (!found) return;
    setActiveId(found.id);
    setMessages(found.messages);
    setToolCalls([]);
    setHistoryOpen(false);
    setQuery("");
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    const next: Msg[] = [...messages, { role: "user" as const, text: clean }];
    setMessages(next);
    setInput("");
    setToolCalls([]);
    setBusy(true);
    setStatus("Thinking…");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, mode, messages: next }),
      });
      if (!res.ok || !res.body) throw new Error(res.status === 401 ? "Session expired" : res.status === 503 ? "Chat not configured" : "Chat error");
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
            | { t: "tool"; name: string; state: ToolCall["state"] }
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
            setStatus(evt.d);
          } else if (evt.t === "tool") {            setToolCalls((prev) => {
              const idx = prev.findIndex((t) => t.name === evt.name && t.state === "input-available");
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx]!, state: evt.state };
                return copy;
              }
              return [...prev, { id: Date.now() + prev.length, name: evt.name, state: evt.state }];
            });
            if (evt.state !== "input-available") setStatus(null);
          } else if (evt.t === "error") {
            throw new Error(evt.d);
          }
        }
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "model", text: `⚠️ ${e instanceof Error ? e.message : "Error"}` }]);    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  if (!open) {
    // Siri-style edge light: animations run perpetually underneath and only
    // the wrapper opacity toggles, so it fades in/out cleanly — never pops.
    return (
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-y-0 right-0 z-40 transition-opacity duration-700 ease-out ${
          askHover ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* soft wash */}
        <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-violet-500/15 via-blue-500/[0.06] to-transparent blur-2xl" />
        {/* core line with a slow highlight drifting down it */}
        <div className="absolute inset-y-6 right-0 w-[2px] overflow-hidden rounded-full bg-white/5">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-400/70 to-blue-500/70" />
          <div className="trell-edge-flow absolute left-0 right-0 h-24 bg-gradient-to-b from-transparent via-white/90 to-transparent" />
        </div>
      </div>
    );
  }

  return (
    <aside className="trell-drawer-right-in relative hidden h-full w-[380px] max-w-[calc(100vw-2rem)] shrink-0 flex-col gap-1 overflow-hidden rounded-xl bg-neutral-100 p-3 md:flex">
        {/* dotted texture (Cloudflare-style) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(0_0_0/0.05)_1px,transparent_0)] bg-[size:22px_22px] dark:bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.06)_1px,transparent_0)]"
        />
        {/* header */}
        <div className="relative flex items-center justify-between px-1 py-1">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex items-center gap-1.5 text-base font-semibold text-trell-ink"
            title="View conversations"
            aria-expanded={historyOpen}
          >
            New conversation
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-neutral-200 transition-all duration-200 dark:bg-neutral-800">
              <span className="trell-icon-arrow" style={{ display: "inline-flex" }}>
                <ChevronDown size={12} className={`text-neutral-500 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              </span>
            </span>
          </button>
          <div className="flex items-center gap-1">
            <button onClick={newChat} className="trell-btn-outline h-9 w-9 !px-0" title="New conversation" aria-label="New conversation">
              <Plus size={14} />
            </button>
            <button onClick={() => { setOpen(false); setHistoryOpen(false); }} className="trell-btn-outline h-9 w-9 !px-0" title="Close" aria-label="Close">
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
                    placeholder="Search…"
                    className="w-full bg-transparent text-[13px] text-trell-ink placeholder:text-neutral-400 focus:outline-none"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {(() => {
                  const q = query.trim().toLowerCase();
                  const filtered = convos.filter((c) => !q || c.title.toLowerCase().includes(q));
                  if (filtered.length === 0) {
                    return <p className="px-3 py-4 text-center text-xs text-trell-ink-muted">No conversations yet.</p>;
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
                          Older
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
                  <Plus size={14} /> New conversation
                </button>
              </div>
            </div>
          )}
        </div>

        {/* messages */}
        <ChatContainerRoot className="relative min-h-0 flex-1">
          <ChatContainerContent className="flex min-h-full flex-col gap-4 px-1 py-2">
            {messages.length === 0 ? (
              <div className="m-auto flex w-full flex-col items-center py-6 text-center">
                <div className="relative mb-4">
                  <div className="absolute inset-0 scale-110 rounded-full bg-violet-500/25 blur-xl" aria-hidden />
                  <Image
                    src="/yoi-logo.png"
                    alt="Yoi"
                    width={88}
                    height={88}
                    className="relative h-[88px] w-[88px] rounded-full shadow-[0_12px_28px_-10px_rgb(139_92_246/0.55)]"
                    priority
                  />
                </div>
                <div className="text-[17px] font-semibold tracking-tight text-trell-ink">{greet} What are we doing today?</div>
                <p className="mt-1 max-w-[250px] text-xs leading-relaxed text-trell-ink-muted">
                  Ask about your metrics, funnels or tracking.
                </p>
              <div className="mt-5 flex w-full flex-col">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={s.title}
                    onClick={() => void send(s.prompt)}
                    className={`flex items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-white/5 ${
                      i > 0 ? "border-t border-trell-line/70 dark:border-white/10" : ""
                    }`}
                  >
                    <s.icon size={16} className="shrink-0 text-neutral-400 dark:text-neutral-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-trell-ink">{s.title}</span>
                      <span className="block truncate text-[13px] text-neutral-500 dark:text-neutral-400">{s.subtitle}</span>
                    </span>
                  </button>
                ))}
              </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="max-w-[90%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-neutral-900 px-3.5 py-2.5 text-sm leading-relaxed text-white dark:bg-[#CDCCCC] dark:text-[#111111]">
                      {m.text}
                    </div>
                  ) : (
                    <div key={i} className="max-w-full self-start text-sm leading-relaxed text-trell-ink">
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ children }) => <div className="mb-1.5 text-[15px] font-semibold text-trell-ink">{children}</div>,
                          h2: ({ children }) => <div className="mb-1.5 text-[15px] font-semibold text-trell-ink">{children}</div>,
                          h3: ({ children }) => <div className="mb-1 mt-3 text-sm font-semibold text-trell-ink first:mt-0">{children}</div>,
                          h4: ({ children }) => <div className="mb-1 mt-2 text-sm font-semibold text-trell-ink">{children}</div>,
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="mb-2 ml-1 flex flex-col gap-1">{children}</ul>,
                          ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal">{children}</ol>,
                          li: ({ children }) => <li className="list-none [&>p]:mb-0">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold text-trell-ink">{children}</strong>,
                          code: ({ children }) => (
                            <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[12px] text-trell-ink dark:bg-[#2a2a29]">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="mb-2 overflow-x-auto rounded-lg bg-neutral-950 p-3 font-mono text-xs leading-relaxed text-neutral-200">
                              {children}
                            </pre>
                          ),
                          hr: () => <hr className="my-3 border-trell-line" />,
                          table: ({ children }) => (
                            <div className="mb-2 overflow-x-auto">
                              <table className="w-full border-collapse text-[13px]">{children}</table>
                            </div>
                          ),
                          th: ({ children }) => (
                            <th className="border-b border-trell-line px-2 py-1 text-left font-semibold text-trell-ink">{children}</th>
                          ),
                          td: ({ children }) => <td className="border-b border-trell-line/60 px-2 py-1">{children}</td>,
                        }}
                      >
                        {m.text || "…"}
                      </Markdown>
                    </div>
                  ),
                )}
                {toolCalls.map((t) => (
                  <Tool key={t.id} toolPart={{ type: t.name, state: t.state }} className="max-w-full self-stretch [&_button]:text-xs" />
                ))}
                {busy && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex items-center gap-2 self-start text-xs text-trell-ink-muted">
                    <span className="flex gap-1" aria-hidden>
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:300ms]" />
                    </span>
                    {status ?? "Thinking…"}
                  </div>
                )}
              </>
            )}
            <ChatContainerScrollAnchor />
          </ChatContainerContent>
          <ScrollButton className="absolute bottom-4 right-4 z-10 bg-white shadow-lg dark:bg-[#1e1e1d]" />
        </ChatContainerRoot>

        {/* composer */}
        <div className="px-1 pb-1 pt-2">
          <PromptInput
            value={input}
            onValueChange={setInput}
            onSubmit={() => send(input)}
            maxHeight={160}
            disabled={busy}
            className="min-h-[104px] rounded-2xl border-trell-line bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-all focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100 dark:border-[#2a2a29] dark:bg-[#1e1e1d] dark:focus-within:border-blue-600 dark:focus-within:ring-blue-950"
          >
            <PromptInputTextarea
              placeholder="Type @ to tag a resource or ? for shortcuts"
              maxLength={2000}
              className="text-sm leading-relaxed text-trell-ink placeholder:text-neutral-400"
            />
            <PromptInputActions className="justify-between pt-0">
              <div className="relative">
                <button
                  onClick={() => setModeOpen((v) => !v)}
                  className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-trell-line px-2.5 text-xs font-medium text-neutral-500 transition-colors hover:text-trell-ink dark:text-neutral-400 dark:hover:text-neutral-100"
                  title="Change mode"
                  aria-label="Change mode"
                  aria-expanded={modeOpen}
                >
                  ✎ {mode === "ask" ? "Ask" : "Do"}
                </button>
                {modeOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setModeOpen(false)} aria-hidden />
                    <div className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-2xl border border-trell-line bg-white p-1.5 shadow-[0_20px_50px_-16px_rgb(24_24_27/0.25)] dark:border-[#2a2a29] dark:bg-[#1e1e1d]">
                      {(
                        [
                          { id: "ask", icon: Pencil, title: "Ask before editing", subtitle: "Review and approve each change" },
                          { id: "do", icon: FastForward, title: "Automatically edit", subtitle: "Always allow edits for this conversation" },
                        ] as const
                      ).map((o) => (
                        <button
                          key={o.id}
                          onClick={() => {
                            setMode(o.id);
                            setModeOpen(false);
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-[#262625] ${
                            mode === o.id ? "bg-neutral-100 dark:bg-[#262625]" : ""
                          }`}
                        >
                          <o.icon size={16} className="shrink-0 text-neutral-500 dark:text-neutral-400" />
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium text-trell-ink">{o.title}</span>
                            <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">{o.subtitle}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="relative flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setToolsOpen((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-trell-ink dark:text-neutral-500 dark:hover:bg-[#2a2a29] dark:hover:text-neutral-100"
                  title="Options"
                  aria-label="Options"
                  aria-expanded={toolsOpen}
                >
                  <SlidersHorizontal size={15} />
                </button>
                <button
                  onClick={() => send(input)}
                  disabled={busy || !input.trim()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#4d88f5] to-[#2563eb] text-white shadow-[inset_0_1px_0_0_#4d88f5,0_1px_2px_rgb(37_99_235/0.4)] transition-all hover:opacity-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send"
                >
                  <ArrowUp size={15} strokeWidth={2.5} />
                </button>
                {toolsOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setToolsOpen(false)} aria-hidden />
                    <div className="absolute bottom-full right-0 z-20 mb-2 w-56 overflow-hidden rounded-xl border border-trell-line bg-white shadow-[0_20px_50px_-16px_rgb(24_24_27/0.25)] dark:border-[#2a2a29] dark:bg-[#1e1e1d]">
                      <div className="px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                        Workspace
                      </div>
                      <div className="truncate px-3 pb-2 font-mono text-xs text-trell-ink">{slug}</div>
                      <div className="border-t border-trell-line p-1.5 dark:border-[#2a2a29]">
                        <button
                          onClick={() => {
                            newChat();
                            setToolsOpen(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-trell-ink transition-colors hover:bg-neutral-100 dark:hover:bg-[#262625]"
                        >
                          <Plus size={13} /> New conversation
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </PromptInputActions>
          </PromptInput>
        </div>
    </aside>
  );
}
