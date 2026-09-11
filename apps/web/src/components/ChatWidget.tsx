"use client";

import { useParams } from "next/navigation";
import Image from "next/image";
import { useEffect, useMemo, useState, Children, isValidElement, type ReactNode } from "react";
import {
  ArrowUp,
  ChartColumn,
  Check,
  Activity,
  ChevronDown,
  Cloud,
  Copy,
  FastForward,
  KeyRound,
  Filter,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChat } from "./ChatProvider";
import { prettyToolName, parseSSEEvent, CHAT_COMMANDS, CHAT_PAGES, findPageMentions } from "@/lib/chatAgent";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChatContainerContent, ChatContainerRoot, ChatContainerScrollAnchor } from "@/components/ui/chat-container";
import {
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { ScrollButton } from "@/components/ui/scroll-button";
import { Tool } from "@/components/ui/tool";

interface Msg {
  id: string;
  role: "user" | "model";
  text: string;
  status?: "sending" | "streaming" | "complete" | "error";
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
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
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

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

function withIds(messages: Msg[]): Msg[] {
  return messages.map((m) => (m.id ? m : { ...m, id: newId() }));
}

function loadConvos(slug: string): Convo[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(CHAT_KEY(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Convo[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages))
      .map((c) => ({ ...c, messages: withIds(c.messages) }))
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

function PanelCloseIcon() {
  return (
    <svg height="18" width="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className="size-4" aria-hidden>
      <g fill="currentColor">
        <path
          d="M4,2.75H14.25c1.105,0,2,.895,2,2V13.25c0,1.105-.895,2-2,2H4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <rect
          height="12.5"
          width="4.5"
          fill="none"
          rx="2"
          ry="2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          x="1.75"
          y="2.75"
        />
      </g>
    </svg>
  );
}

function ActionButton({
  label,
  title,
  onClick,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-trell-ink focus-visible:outline-2 focus-visible:outline-blue-500 active:bg-neutral-200 dark:text-neutral-500 dark:hover:bg-[#2a2a29] dark:hover:text-neutral-100"
    >
      {children}
    </button>
  );
}

function MessageActions({
  message,
  canRegenerate,
  onRegenerate,
}: {
  message: Msg;
  canRegenerate: boolean;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = message.text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mt-1.5 flex items-center gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
      {copied ? (
        <span className="flex h-7 items-center gap-1 px-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <Check size={13} /> Copied
        </span>
      ) : (
        <ActionButton label="Copy response" title="Copy" onClick={() => void copy()}>
          <Copy size={13} />
        </ActionButton>
      )}
      {canRegenerate && (
        <ActionButton label="Regenerate response" title="Regenerate" onClick={onRegenerate}>
          <RotateCcw size={13} />
        </ActionButton>
      )}
      <ActionButton
        label="Mark as helpful"
        title="Helpful"
        onClick={() => setVote((v) => (v === "up" ? null : "up"))}
      >
        <ThumbsUp size={13} className={vote === "up" ? "fill-emerald-500 text-emerald-500" : undefined} />
      </ActionButton>
      <ActionButton
        label="Mark as not helpful"
        title="Not helpful"
        onClick={() => setVote((v) => (v === "down" ? null : "down"))}
      >
        <ThumbsDown size={13} className={vote === "down" ? "fill-red-500 text-red-500" : undefined} />
      </ActionButton>
    </div>
  );
}

/** Plain text out of a markdown cell (handles nested elements). */
function nodeText(n: ReactNode): string {
  if (n === null || n === undefined || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(nodeText).join("");
  if (isValidElement(n)) return nodeText((n.props as { children?: ReactNode }).children);
  return "";
}

function tableCells(row: ReactNode): string[] {
  return Children.toArray(row)
    .filter(isValidElement)
    .map((c) => nodeText((c.props as { children?: ReactNode }).children));
}

/**
 * Wide tables become stacked label:value cards (nothing cut off);
 * narrow ones keep the classic scrollable table.
 */
function ResponsiveTable({ children }: { children: ReactNode }) {
  let headers: string[] = [];
  const rows: string[][] = [];
  Children.forEach(children, (section) => {
    if (!isValidElement(section)) return;
    const kind = section.type as string;
    const trs = Children.toArray((section.props as { children?: ReactNode }).children).filter(isValidElement);
    for (const tr of trs) {
      if ((tr.type as string) !== "tr") continue;
      const cells = tableCells((tr.props as { children?: ReactNode }).children);
      if (kind === "thead") {
        if (cells.length > 0) headers = cells;
      } else if (kind === "tbody") {
        rows.push(cells);
      }
    }
  });
  if (headers.length > 3 && rows.length > 0) {
    return (
      <div className="mb-2 flex max-w-full flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="rounded-lg border border-trell-line bg-white px-3 py-1.5 dark:bg-[#1e1e1d]">
            {r.map((cell, j) => (
              <div
                key={j}
                className="flex items-baseline justify-between gap-3 border-b border-trell-line/50 py-1 text-[13px] last:border-0"
              >
                <span className="shrink-0 font-medium text-trell-ink-muted">{headers[j] ?? `#${j + 1}`}</span>
                <span className="min-w-0 break-words text-right text-trell-ink">{cell || "—"}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mb-2 max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  );
}

function ReasoningBlock({ text, streaming }: { text: string; streaming: boolean }) {  const [open, setOpen] = useState(true);
  return (
    <div className="mb-1">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex min-h-7 cursor-pointer items-center gap-1 text-xs font-medium text-trell-ink-muted transition-colors hover:text-trell-ink">
          <ChevronDown size={13} className={`transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
          {streaming ? "Reasoning…" : open ? "Hide reasoning" : "Show reasoning"}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1.5 max-h-56 overflow-y-auto whitespace-pre-wrap break-words border-l-2 border-trell-line pl-3 text-[13px] leading-relaxed text-trell-ink-muted">
            {text}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
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
  const [thoughts, setThoughts] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [convos, setConvos] = useState<Convo[]>(() => (slug ? loadConvos(slug) : []));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [menu, setMenu] = useState<{ kind: "@" | "/"; query: string } | null>(null);
  const [menuIndex, setMenuIndex] = useState(0);
  const greet = useMemo(greeting, []);

  const menuItems = useMemo(() => {
    if (!menu) return [] as { id: string; primary: string; secondary: string }[];
    const q = menu.query.toLowerCase();
    if (menu.kind === "@") {
      return CHAT_PAGES.filter((p) => !q || p.id.includes(q) || p.label.toLowerCase().includes(q)).map((p) => ({
        id: p.id,
        primary: `@${p.id}`,
        secondary: `${p.label} · ${p.hint}`,
      }));
    }
    return CHAT_COMMANDS.filter((c) => !q || c.id.includes(q)).map((c) => ({
      id: c.id,
      primary: c.label,
      secondary: c.hint,
    }));
  }, [menu]);

  const inputMentions = useMemo(() => findPageMentions(input), [input]);

  function handleInput(v: string) {
    setInput(v);
    const m = v.match(/(^|\s)([@/])([\w-]*)$/);
    if (m && !busy) {
      setMenu({ kind: m[2] as "@" | "/", query: m[3] ?? "" });
      setMenuIndex(0);
    } else {
      setMenu(null);
    }
  }

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
    setThoughts("");
    setHistoryOpen(false);
    setQuery("");
  }

  function openConvo(id: string) {
    const found = convos.find((c) => c.id === id);
    if (!found) return;
    setActiveId(found.id);
    setMessages(found.messages);
    setToolCalls([]);
    setThoughts("");
    setHistoryOpen(false);
    setQuery("");
  }

  function persistConvos(next: Convo[]) {
    setConvos(next);
    if (!slug) return;
    try {
      localStorage.setItem(CHAT_KEY(slug), JSON.stringify(next.slice(0, MAX_CONVOS)));
    } catch {
      // storage full or unavailable — chat still works in memory
    }
  }

  function deleteConvo(id: string) {
    persistConvos(convos.filter((c) => c.id !== id));
    if (id === activeId) {
      setActiveId(null);
      setMessages([]);
      setToolCalls([]);
      setThoughts("");
    }
  }

  function close() {
    if (leaving) return;
    setHistoryOpen(false);
    setLeaving(true);
    window.setTimeout(() => {
      setOpen(false);
      setLeaving(false);
    }, 210);
  }

  function selectMenuItemAt(idx: number) {
    if (busy || !menu || menuItems.length === 0) return;
    const item = menuItems[Math.min(Math.max(idx, 0), menuItems.length - 1)]!;
    if (menu.kind === "@") {
      handleInput(input.replace(/[@][\w-]*$/, `@${item.id} `));
    } else {
      setMenu(null);
      setInput("");
      void runCommand(item.id);
    }
  }

  function sendLocalHelp() {
    const userMsg: Msg = { id: newId(), role: "user" as const, text: "/help", status: "sending" as const };
    const body = [
      "**Commands** (deterministic ones use zero AI requests):",
      ...CHAT_COMMANDS.map((c) => `- ${c.label} — ${c.hint}`),
      "",
      "**Pages** (mention with @ to attach live context):",
      ...CHAT_PAGES.map((p) => `- @${p.id} — ${p.label}: ${p.hint}`),
    ].join("\n");
    setMessages((prev) => [...prev, userMsg, { id: newId(), role: "model", text: body, status: "complete" as const }]);
    setInput("");
    setMenu(null);
  }

  async function runCommand(id: string) {
    if (busy) return;
    setMenu(null);
    const next: Msg[] = [...messages, { id: newId(), role: "user" as const, text: `/${id}`, status: "sending" as const }];
    setMessages(next);
    setInput("");
    setToolCalls([]);
    setThoughts("");
    setBusy(true);
    setStatus("Running command…");
    try {
      const res = await fetch("/api/chat/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, command: id }),
      });
      if (!res.ok) throw new Error(res.status === 401 ? "Session expired" : "Command failed");
      const j = (await res.json()) as { text?: unknown; error?: unknown };
      if (typeof j.error === "string" && j.error) throw new Error(j.error);
      const text = typeof j.text === "string" && j.text ? j.text : "No output.";
      setMessages((prev) => [...prev, { id: newId(), role: "model", text, status: "complete" as const }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "model", text: `⚠️ ${e instanceof Error ? e.message : "Error"}`, status: "error" as const },
      ]);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setMenu(null);
    const cmd = clean.match(/^\/([\w-]+)\s*$/);
    if (cmd) {
      const id = cmd[1]!.toLowerCase();
      if (id === "help") {
        sendLocalHelp();
        return;
      }
      if (CHAT_COMMANDS.some((c) => c.id === id && !c.local)) {
        void runCommand(id);
        return;
      }
    }
    const mentions = findPageMentions(clean);
    const next: Msg[] = [...messages, { id: newId(), role: "user" as const, text: clean, status: "sending" as const }];
    setMessages(next);
    setInput("");
    setToolCalls([]);
    setThoughts("");
    if (mentions.length === 0) {
      await runCompletion(next);
      return;
    }
    // @page context: one MCP snapshot each, zero LLM turns. The model
    // usually answers straight from it, saving tool-call round-trips.
    setBusy(true);
    setStatus("Loading page context…");
    try {
      const parts = await Promise.all(
        mentions.map(async (id) => {
          try {
            const res = await fetch("/api/chat/context", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug, page: id }),
            });
            if (!res.ok) return null;
            const j = (await res.json()) as { label?: unknown; data?: unknown };
            const s = JSON.stringify(j.data) ?? "";
            const label = typeof j.label === "string" && j.label ? j.label : id;
            return `[Context @${id} — ${label}]:\n${s.length > 4000 ? `${s.slice(0, 4000)}… (truncated)` : s}`;
          } catch {
            return null;
          }
        }),
      );
      const ctx = parts.filter((p): p is string => !!p).join("\n\n");
      const base = ctx
        ? [...next.slice(0, -1), { ...next[next.length - 1]!, text: `${ctx}\n\n${clean}` }]
        : next;
      await runCompletion(base);
    } catch {
      await runCompletion(next);
    }
  }

  /** Regenerate: drop the trailing assistant message and run again. No backend change. */
  async function regenerate(messageId: string) {
    if (busy) return;
    const idx = messages.findIndex((m) => m.id === messageId && m.role === "model");
    if (idx <= 0) return;
    const base = messages.slice(0, idx);
    if (base[base.length - 1]?.role !== "user") return;
    setMessages(base);
    setToolCalls([]);
    setThoughts("");
    await runCompletion(base);
  }

  async function runCompletion(base: Msg[]) {
    setBusy(true);
    setStatus("Thinking…");
    const assistantId = newId();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          mode,
          messages: base.map(({ role, text }) => ({ role, text })),
        }),
      });
      if (!res.ok || !res.body) throw new Error(res.status === 401 ? "Session expired" : res.status === 503 ? "Chat not configured" : "Chat error");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let modelText = "";
      let started = false;
      const appendText = (snapshot: string) => {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { id: assistantId, role: "model", text: snapshot, status: "streaming" as const };
          return copy;
        });
      };
      setMessages((prev) => [...prev, { id: assistantId, role: "model", text: "", status: "streaming" as const }]);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const evt = parseSSEEvent(line);
          if (!evt) continue;
          if (evt.t === "thought") {
            const d = evt.d;
            setThoughts((prev) => prev + d);
          } else if (evt.t === "text") {
            modelText += evt.d;
            started = true;
            appendText(modelText);
          } else if (evt.t === "status") {
            setStatus(evt.d);
          } else if (evt.t === "tool") {
            const state = evt.state;
            const input = evt.input;
            const output = evt.output;
            const errorText = evt.errorText;
            setToolCalls((prev) => {
              const idx = prev.findIndex((t) => t.name === evt.name && t.state === "input-available");
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = {
                  ...copy[idx]!,
                  state,
                  input: input ?? copy[idx]!.input,
                  output: output ?? copy[idx]!.output,
                  errorText: errorText ?? copy[idx]!.errorText,
                };
                return copy;
              }
              return [...prev, { id: Date.now() + prev.length, name: evt.name, state, input, output, errorText }];
            });
            if (evt.state !== "input-available") setStatus(null);
          } else if (evt.t === "error") {
            throw new Error(evt.d);
          }
        }
      }
      if (!started && !modelText) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { id: assistantId, role: "model", text: "I couldn't generate a response. Try again.", status: "error" as const };
          return copy;
        });
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, status: "complete" as const } : m)),
        );
      }
    } catch (e) {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.id === assistantId) {
          const copy = [...prev];
          copy[copy.length - 1] = {
            id: assistantId,
            role: "model",
            text: `⚠️ ${e instanceof Error ? e.message : "Error"}`,
            status: "error" as const,
          };
          return copy;
        }
        return [...prev, { id: newId(), role: "model", text: `⚠️ ${e instanceof Error ? e.message : "Error"}`, status: "error" as const }];
      });
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  const lastMsg = messages[messages.length - 1];
  const awaitingResponse =
    busy && lastMsg && (lastMsg.role === "user" || (lastMsg.role === "model" && !lastMsg.text));

  if (!open) {
    // Siri-style edge light: symmetric fades (both ends transparent, color
    // handoff at the center) + perpetual motion underneath; only the wrapper
    // opacity toggles, so it fades in/out cleanly — never pops.
    return (
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-y-0 right-0 z-40 transition-opacity duration-700 ease-out ${
          askHover ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* soft wash */}
        <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-violet-500/15 via-blue-500/[0.06] to-transparent blur-2xl" />
        {/* core line: transparent ends, violet→blue handoff at center */}
        <div className="absolute inset-y-0 right-0 w-[2px] bg-[linear-gradient(to_bottom,transparent_0%,rgba(139,92,246,0)_12%,rgba(139,92,246,0.65)_42%,rgba(96,165,250,0.65)_58%,rgba(96,165,250,0)_88%,transparent_100%)]" />
        {/* traveling highlight, also symmetric */}
        <div className="trell-edge-flow absolute right-0 top-0 h-32 w-[2px] bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.9)_50%,transparent)]" />
      </div>
    );
  }

  return (
    <aside className={`yoi-chat relative hidden h-full w-[440px] max-w-[calc(100vw-2rem)] shrink-0 flex-col gap-1 overflow-hidden rounded-xl bg-neutral-100 p-3 md:flex ${leaving ? "trell-chat-out" : "trell-drawer-right-in"}`}>
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
            <button onClick={close} className="trell-btn-outline h-9 w-9 !px-0" title="Close" aria-label="Close">
              <PanelCloseIcon />
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
              <div className="max-h-[196px] overflow-y-auto p-2">
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
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openConvo(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") openConvo(c.id);
                      }}
                      className={`group/row flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-[#262625] ${
                        c.id === activeId ? "bg-neutral-100 dark:bg-[#262625]" : ""
                      }`}
                    >
                      <span className="min-w-0 truncate text-[13px] text-trell-ink">{c.title}</span>
                      <span className="flex shrink-0 items-center gap-0.5">
                        <span className="text-[11px] tabular-nums text-neutral-400">{ago(c.updatedAt)}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConvo(c.id);
                          }}
                          title="Delete conversation"
                          aria-label={`Delete ${c.title}`}
                          className="hidden h-6 w-6 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-red-600 group-hover/row:flex dark:hover:bg-[#333332] dark:hover:text-red-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    </div>
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
          <ChatContainerContent className="flex min-h-full flex-col gap-4 px-1 py-2" aria-live="polite" aria-label="Conversation">
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
                  Ask about your metrics, funnels or tracking. Type / for shortcuts.
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
                {messages.map((m, i) => {
                  const isLast = i === messages.length - 1;
                  const streaming = busy && isLast && m.role === "model" && m.status !== "error";
                  if (m.role === "user") {
                    return (
                      <div key={m.id} className="trell-msg-in max-w-[75%] self-end whitespace-pre-wrap rounded-[18px_18px_5px_18px] bg-neutral-900 px-[14px] py-[10px] text-sm leading-relaxed text-white max-md:max-w-[88%] dark:bg-[#CDCCCC] dark:text-[#111111]">
                        {m.text}
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className="group flex max-w-full items-start gap-2.5 self-stretch">
                      <Image
                        src="/yoi-logo.png"
                        alt="Yoi"
                        width={28}
                        height={28}
                        className="mt-0.5 h-7 w-7 shrink-0 rounded-full"
                      />
                      <div className="min-w-0 flex-1 text-[15px] leading-[1.7] text-trell-ink">
                        {thoughts && isLast ? <ReasoningBlock text={thoughts} streaming={streaming} /> : null}
                        {m.text ? (
                          <>
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
                            em: ({ children }) => <em>{children}</em>,
                            a: ({ children, href }) => (
                              <a href={href} target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700 dark:text-blue-400">
                                {children}
                              </a>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="mb-2 border-l-2 border-trell-line pl-3 text-trell-ink-muted [&>p]:mb-1">
                                {children}
                              </blockquote>
                            ),
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
                            table: ({ children }) => <ResponsiveTable>{children}</ResponsiveTable>,
                            th: ({ children }) => (
                              <th className="whitespace-nowrap border-b border-trell-line px-2 py-1 text-left font-semibold text-trell-ink">{children}</th>
                            ),
                            td: ({ children }) => <td className="whitespace-nowrap border-b border-trell-line/60 px-2 py-1">{children}</td>,
                          }}
                        >
                          {m.text}
                        </Markdown>
                          </>
                        ) : null}
                        {m.status === "complete" && m.text && !streaming && (
                          <MessageActions
                            message={m}
                            canRegenerate={isLast}
                            onRegenerate={() => void regenerate(m.id)}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
                {toolCalls.map((t) => (
                  <Tool
                    key={t.id}
                    toolPart={{ type: prettyToolName(t.name), state: t.state, input: t.input, output: t.output, errorText: t.errorText }}
                    className="max-w-full self-start [&_button]:text-xs"
                  />
                ))}
                {awaitingResponse ? (
                  <div className="flex items-center gap-1.5 self-start text-[13px]" role="status">
                    <Cloud size={14} className="shrink-0 text-trell-ink-muted" aria-hidden />
                    <span className="trell-shimmer font-medium">{status ?? "Thinking…"}</span>
                  </div>
                ) : null}
              </>
            )}
            <ChatContainerScrollAnchor />
          </ChatContainerContent>
          <ScrollButton className="absolute bottom-4 right-4 z-10 bg-white shadow-lg dark:bg-[#1e1e1d]" />
        </ChatContainerRoot>

        {/* composer */}
        <div className="relative px-1 pb-1 pt-2">
          {menu && menuItems.length > 0 && (
            <div className="absolute inset-x-1 bottom-full z-20 mb-2 overflow-hidden rounded-xl border border-trell-line bg-white shadow-[0_20px_50px_-16px_rgb(24_24_27/0.25)] dark:border-[#2a2a29] dark:bg-[#1e1e1d]">
              <div className="px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                {menu.kind === "@" ? "Pages — attach live context" : "Commands — zero AI requests"}
              </div>
              <div className="max-h-56 overflow-y-auto p-1.5">
                {menuItems.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectMenuItemAt(i);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                      i === Math.min(menuIndex, menuItems.length - 1)
                        ? "bg-neutral-100 dark:bg-[#262625]"
                        : "hover:bg-neutral-100 dark:hover:bg-[#262625]"
                    }`}
                  >
                    <span className="shrink-0 font-mono text-[13px] font-medium text-trell-ink">{item.primary}</span>
                    <span className="min-w-0 truncate text-xs text-neutral-500 dark:text-neutral-400">{item.secondary}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {inputMentions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1 pb-2">
              {inputMentions.map((id) => (
                <span
                  key={id}
                  className="flex items-center gap-1 rounded-full border border-trell-line bg-white py-0.5 pl-2.5 pr-1 text-xs font-medium text-trell-ink dark:bg-[#1e1e1d]"
                >
                  @{CHAT_PAGES.find((p) => p.id === id)?.label ?? id}
                  <button
                    type="button"
                    onClick={() => handleInput(input.replace(new RegExp(`@${id}\\b\\s?`, "i"), ""))}
                    title={`Remove @${id}`}
                    aria-label={`Remove @${id}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-trell-ink dark:hover:bg-[#2a2a29]"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <PromptInput
            value={input}
            onValueChange={handleInput}
            onSubmit={() => {
              if (menu && menuItems.length > 0) {
                selectMenuItemAt(Math.min(menuIndex, menuItems.length - 1));
                return;
              }
              send(input);
            }}
            maxHeight={160}
            disabled={busy}
            className="min-h-[104px] rounded-2xl border-trell-line bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-all focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100 dark:border-[#2a2a29] dark:bg-[#1e1e1d] dark:focus-within:border-blue-600 dark:focus-within:ring-blue-950"
          >
            <PromptInputTextarea
              placeholder="Type @ for pages, / for commands"
              maxLength={2000}
              onKeyDown={(e) => {
                if (!menu) return;
                const last = Math.max(menuItems.length - 1, 0);
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMenuIndex((i) => (i + 1) % Math.max(menuItems.length, 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMenuIndex((i) => (i - 1 + menuItems.length) % Math.max(menuItems.length, 1));
                } else if (e.key === "Tab" && menuItems.length > 0) {
                  e.preventDefault();
                  selectMenuItemAt(Math.min(menuIndex, last));
                } else if (e.key === "Escape") {
                  setMenu(null);
                }
              }}
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
