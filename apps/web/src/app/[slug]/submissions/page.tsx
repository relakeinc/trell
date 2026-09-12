"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Icon } from "@/components/Icon";
import { AskYoiButton } from "@/components/AskYoiButton";
import { DateTimeField } from "@/components/DateTimeField";
import { useProjectId, useProjectSubmissions } from "@/lib/hooks";
import { fmtTime, localInput } from "@/lib/format";

// ── Helpers ──────────────────────────────────────────────────

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? "" : "s"} ago`;
  return `${Math.floor(mo / 12)} year${Math.floor(mo / 12) === 1 ? "" : "s"} ago`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function fieldEntries(fields: unknown): [string, string][] {
  if (!fields || typeof fields !== "object") return [];
  const obj = fields as Record<string, unknown>;
  const inner = obj.fields && typeof obj.fields === "object" ? (obj.fields as Record<string, unknown>) : obj;
  const skip = new Set(["form", "formId", "formName", "page", "url"]);
  const rows: [string, string][] = Object.entries(inner)
    .filter(([k]) => !skip.has(k))
    .map(([k, v]): [string, string] => {
      if (typeof v === "object" && v !== null) return [k, JSON.stringify(v)];
      return [k, String(v ?? "")];
    });
  return rows.filter(([, v]) => v !== "");
}

function prettyKey(k: string): string {
  return k
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/** Neutral tile for every form; color lives only on the glyph. */
const FORM_TILE = "bg-neutral-200/70 dark:bg-white/10";

const ICON_TONES = [
  "text-emerald-600",
  "text-violet-600",
  "text-blue-600",
  "text-amber-600",
  "text-rose-500",
  "text-cyan-600",
];

function toneFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ICON_TONES[h % ICON_TONES.length]!;
}

type SortKey = "az" | "responses" | "newest" | "oldest";

type TypeFilter = "" | "form_success" | "form_submit";

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "form_success", label: "Conversions" },
  { value: "form_submit", label: "Submits" },
];

const SORTS: { value: SortKey; label: string }[] = [
  { value: "az", label: "Sort by A–Z" },
  { value: "responses", label: "Most responses" },
  { value: "newest", label: "Recently active" },
  { value: "oldest", label: "Oldest first" },
];

// ── Page ─────────────────────────────────────────────────────

export default function SubmissionsPage() {
  const { projectId } = useProjectId();
  const { data, isLoading } = useProjectSubmissions(projectId);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("az");
  const [sortOpen, setSortOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [from, setFrom] = useState(localInput(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(localInput(new Date(Date.now() + 86400000)));
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu && !sortOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setSortOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setSortOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu, sortOpen]);

  const submissions = useMemo(() => {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();
    return (data?.submissions ?? []).filter((s) => {
      if (s.type !== "form_submit" && s.type !== "form_success") return false;
      if (typeFilter && s.type !== typeFilter) return false;
      const t = new Date(s.ts).getTime();
      if (Number.isFinite(fromMs) && t < fromMs) return false;
      if (Number.isFinite(toMs) && t > toMs) return false;
      return true;
    });
  }, [data, from, to, typeFilter]);

  interface FormGroup {
    key: string;
    name: string;
    formId: string;
    count: number;
    conversions: number;
    lastTs: string;
    firstTs: string;
    pages: string[];
    recent: typeof submissions;
  }

  const groups = useMemo<FormGroup[]>(() => {
    const map = new Map<string, FormGroup>();
    for (const s of submissions) {
      const key = s.formId || s.formName || s.id;
      const g = map.get(key);
      if (!g) {
        map.set(key, {
          key,
          name: s.formName || s.formId,
          formId: s.formId,
          count: 1,
          conversions: s.type === "form_success" ? 1 : 0,
          lastTs: s.ts,
          firstTs: s.ts,
          pages: s.page ? [s.page] : [],
          recent: [s],
        });
      } else {
        g.count += 1;
        if (s.type === "form_success") g.conversions += 1;
        if (s.ts > g.lastTs) g.lastTs = s.ts;
        if (s.ts < g.firstTs) g.firstTs = s.ts;
        if (s.page && !g.pages.includes(s.page)) g.pages.push(s.page);
        g.recent.push(s);
      }
    }
    for (const g of map.values()) g.recent.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return [...map.values()];
  }, [submissions]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? groups.filter((g) => [g.name, g.formId, ...g.pages].join(" ").toLowerCase().includes(q))
      : [...groups];
    switch (sort) {
      case "az":
        rows.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "responses":
        rows.sort((a, b) => b.count - a.count);
        break;
      case "newest":
        rows.sort((a, b) => (a.lastTs < b.lastTs ? 1 : -1));
        break;
      case "oldest":
        rows.sort((a, b) => (a.firstTs < b.firstTs ? 1 : -1));
        break;
    }
    return rows;
  }, [groups, query, sort]);

  function copy(text: string, key: string) {
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(key);
        window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
      },
      () => {},
    );
  }

  function exportGroup(g: FormGroup) {
    const rows = g.recent.map((s) => ({ s, entries: fieldEntries(s.fields) }));
    const fieldKeys = Array.from(new Set(rows.flatMap((r) => r.entries.map(([k]) => k))));
    const header = ["Form", "Page", "Received", "Visitor ID", ...fieldKeys];
    const lines = [header];
    for (const { s, entries } of rows) {
      const map = new Map(entries);
      lines.push([
        g.name,
        s.page,
        new Date(s.ts).toLocaleString(),
        s.visitorId,
        ...fieldKeys.map((k) => map.get(k) ?? ""),
      ]);
    }
    const csv = lines.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${g.formId || "form"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setOpenMenu(null);
  }

  const sortLabel = SORTS.find((s) => s.value === sort)!.label;

  return (
    <div className="trell-content">
      <header className="trell-header -mx-6 -mt-3 mb-6 px-6 pt-6">
        <div>
          <h1 className="text-base font-semibold text-trell-ink">Submissions</h1>
          {/* <p className="mt-0.5 text-xs text-trell-ink-muted">
            {isLoading ? "Loading…" : `${groups.length} form${groups.length === 1 ? "" : "s"} · ${submissions.length} responses`}
          </p> */}
        </div>
        <div className="flex items-center gap-2">
          <AskYoiButton />
        </div>
      </header>

      <div className="mb-4 rounded-2xl border border-trell-line bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-neutral-500">From</span>
            <DateTimeField value={from} onChange={setFrom} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-neutral-500">To</span>
            <DateTimeField value={to} onChange={setTo} />
          </label>
        </div>
        <div className="scrollbar-hide mt-3 flex items-center gap-0.5 overflow-x-auto whitespace-nowrap rounded-lg bg-neutral-100 p-0.5">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                typeFilter === t.value ? "bg-white text-trell-ink shadow-sm" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex h-9 w-full items-center gap-2 rounded-full border border-trell-line bg-white px-3.5 transition-all focus-within:border-neutral-400 focus-within:ring-4 focus-within:ring-neutral-100 sm:w-60">
          <Icon name="search" size={15} className="shrink-0 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search .."
            className="w-full min-w-0 bg-transparent text-[13px] text-trell-ink outline-none placeholder:text-neutral-400"
          />
        </label>
        <div className="ml-auto flex items-center gap-2" ref={menuRef}>
          <div className="relative">
            <button
              onClick={() => {
                setSortOpen((o) => !o);
                setOpenMenu(null);
              }}
              aria-expanded={sortOpen}
              className="trell-btn-outline h-9 gap-1.5 rounded-full border border-trell-line bg-white px-3 text-[13px] font-normal shadow-sm"
            >
              {sortLabel}
              <ChevronDown
                size={14}
                className={`text-neutral-400 transition-transform ${sortOpen ? "rotate-180" : ""}`}
              />
            </button>
            {sortOpen && (
              <div className="trell-pop-in absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-trell-line bg-white py-1 shadow-xl">
                {SORTS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => {
                      setSort(o.value);
                      setSortOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] transition-colors hover:bg-neutral-50 ${
                      sort === o.value ? "font-medium text-trell-ink" : "text-neutral-600"
                    }`}
                  >
                    {o.label}
                    {sort === o.value && <Icon name="check" size={14} className="text-neutral-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="trell-card overflow-hidden">
        <table className="trell-table trell-table-plain w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="border-b border-trell-line text-left text-[13px] text-neutral-500">
              <th className="bg-white pb-2 pl-4 pr-2 pt-3 font-normal sm:pl-5">Form name</th>
              <th className="hidden bg-white px-2 pb-2 pt-3 font-normal sm:table-cell">Response</th>
              <th className="hidden bg-white px-2 pb-2 pt-3 font-normal md:table-cell">Last modified</th>
              <th className="hidden bg-white px-2 pb-2 pt-3 font-normal lg:table-cell">Created</th>
              <th className="bg-white pb-2 pl-2 pr-4 pt-3 text-right font-normal sm:pr-5">
                <span className="sm:hidden">Responses</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i} className="border-t border-trell-line">
                    <td className="py-3.5 pl-4 sm:pl-5">
                      <div className="flex items-center gap-3">
                        <div className="trell-skeleton h-8 w-8 rounded-lg" />
                        <div>
                          <div className="trell-skeleton h-4 w-40" />
                          <div className="trell-skeleton mt-1.5 h-3 w-24" />
                        </div>
                      </div>
                    </td>
                    <td className="hidden py-3.5 sm:table-cell">
                      <div className="trell-skeleton h-4 w-8" />
                    </td>
                    <td className="hidden py-3.5 md:table-cell">
                      <div className="trell-skeleton h-4 w-24" />
                    </td>
                    <td className="hidden py-3.5 lg:table-cell">
                      <div className="trell-skeleton h-4 w-24" />
                    </td>
                    <td className="py-3.5 pr-4 sm:pr-5" />
                  </tr>
                ))
              : visible.map((g) => {
                  const isOpen = expanded === g.key;
                  const menuForRow = openMenu === g.key;
                  return (
                    <Fragment key={g.key}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : g.key)}
                        className={`cursor-pointer border-t border-trell-line transition-colors hover:bg-neutral-50 ${isOpen ? "bg-neutral-50/60" : ""}`}
                      >
                        <td className="max-w-[220px] py-3 pl-4 sm:max-w-none sm:pl-5">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${FORM_TILE}`}
                            >
                              <Icon name="send" size={14} className={toneFor(g.key)} />
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-medium text-trell-ink" title={g.name}>
                                {g.name}
                              </div>
                              <div className="truncate text-xs text-neutral-400" title={g.formId}>
                                {g.pages[0] ?? g.formId}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden whitespace-nowrap px-2 py-3 tabular-nums text-[13px] text-trell-ink sm:table-cell">
                          {g.count}
                        </td>
                        <td
                          className="hidden whitespace-nowrap px-2 py-3 text-[13px] tabular-nums text-neutral-500 md:table-cell"
                          title={fmtTime(g.lastTs)}
                        >
                          {fmtDate(g.lastTs)}
                        </td>
                        <td
                          className="hidden whitespace-nowrap px-2 py-3 text-[13px] tabular-nums text-neutral-500 lg:table-cell"
                          title={new Date(g.firstTs).toLocaleString()}
                        >
                          {ago(g.firstTs)}
                        </td>
                        <td className="whitespace-nowrap py-3 pl-2 pr-4 text-right sm:pr-5">
                          <span className="mr-2 tabular-nums text-[13px] text-trell-ink sm:hidden">{g.count}</span>
                          <span className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setOpenMenu(menuForRow ? null : g.key);
                                setSortOpen(false);
                              }}
                              aria-label={`Actions for ${g.name}`}
                              className="rounded-md px-1.5 py-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                            >
                              ⋮
                            </button>
                            {menuForRow && (
                              <div className="trell-pop-in absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-xl border border-trell-line bg-white py-1 text-left shadow-xl">
                                <button
                                  onClick={() => exportGroup(g)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-neutral-600 transition-colors hover:bg-neutral-50"
                                >
                                  <Icon name="download" size={14} />
                                  Export CSV
                                </button>
                                <button
                                  onClick={() => {
                                    copy(g.formId, `form:${g.key}`);
                                    setOpenMenu(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-neutral-600 transition-colors hover:bg-neutral-50"
                                >
                                  <Icon name={copied === `form:${g.key}` ? "check" : "send"} size={14} />
                                  {copied === `form:${g.key}` ? "Copied ID" : "Copy form ID"}
                                </button>
                              </div>
                            )}
                          </span>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-t border-trell-line">
                          <td colSpan={5} className="bg-white px-4 py-3 sm:px-5">
                            <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                              <span>
                                <strong className="font-semibold tabular-nums text-trell-ink">{g.count}</strong>{" "}
                                responses
                              </span>
                              <span>
                                <strong className="font-semibold tabular-nums text-trell-ink">{g.conversions}</strong>{" "}
                                converted
                              </span>
                              {g.pages.length > 1 && <span>{g.pages.length} pages</span>}
                              <button
                                onClick={() => exportGroup(g)}
                                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-trell-line bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
                              >
                                <Icon name="download" size={13} />
                                Export this form
                              </button>
                            </div>
                            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-trell-line">
                              {g.recent.slice(0, 5).map((s) => {
                                const entries = fieldEntries(s.fields);
                                const summary = entries
                                  .slice(0, 3)
                                  .map(([, v]) => v)
                                  .join(" · ");
                                const key = `copy:${s.id}`;
                                const isCopied = copied === key;
                                const converted = s.type === "form_success";
                                return (
                                  <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                                    <span
                                      title={converted ? "Conversion" : "Submission"}
                                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${converted ? "bg-emerald-500" : "bg-neutral-300"}`}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div
                                        className="truncate text-[13px] text-trell-ink"
                                        title={entries.map(([k, v]) => `${prettyKey(k)}: ${v}`).join("\n") || s.page}
                                      >
                                        {summary || "Empty response"}
                                      </div>
                                      <div
                                        className="truncate text-[11px] tabular-nums text-neutral-400"
                                        title={new Date(s.ts).toLocaleString()}
                                      >
                                        {s.page} · {ago(s.ts)}
                                        {converted ? " · Converted" : ""}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() =>
                                        copy(entries.map(([k, v]) => `${prettyKey(k)}: ${v}`).join("\n") || s.id, key)
                                      }
                                      className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                                        isCopied
                                          ? "text-emerald-600"
                                          : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                                      }`}
                                    >
                                      {isCopied ? "Copied" : "Copy"}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                            {g.count > 5 && (
                              <p className="mt-2 text-center text-[11px] text-neutral-400">
                                Showing 5 of {g.count} — export CSV for the full list.
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
          </tbody>
        </table>

        {!isLoading && submissions.length === 0 && (
          <div className="trell-empty-state">
            <div className="trell-empty-state-icon">
              <Icon name="send" size={22} />
            </div>
            <p className="text-sm font-medium text-trell-ink">No submissions yet</p>
            <p className="mt-1 max-w-sm text-sm text-trell-ink-muted">
              Forms will appear here as soon as someone submits a tracked form on your site.
            </p>
          </div>
        )}
        {!isLoading && submissions.length > 0 && visible.length === 0 && (
          <div className="trell-empty-state">
            <div className="trell-empty-state-icon">
              <Icon name="search" size={22} />
            </div>
            <p className="text-sm font-medium text-trell-ink">No forms match “{query}”</p>
            <button
              onClick={() => {
                setQuery("");
                setTypeFilter("");
              }}
              className="mt-3 rounded-lg border border-trell-line px-3 py-1.5 text-xs font-medium text-trell-ink transition-colors hover:bg-neutral-50"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
