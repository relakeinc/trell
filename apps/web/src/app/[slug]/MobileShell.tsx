"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Filter,
  Plus,
  Search,
  Send,
  Settings as SettingsIcon,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { Icon } from "@/components/Icon";
import { WorkspaceIcon } from "@/components/WorkspaceIcon";
import { useMounted } from "@/components/Transitions";
import { useChat } from "@/components/ChatProvider";
import { useProjectId, useProjectStats } from "@/lib/hooks";
import { humanMs, localInput, pct, rangeQs } from "@/lib/format";

interface SidebarProject {
  id: string;
  name: string;
  slug: string;
  role: string;
  logoVariant: number;
}

interface MobileShellContextValue {
  sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  topBarActions: ReactNode;
  setTopBarActions: (node: ReactNode) => void;
}

const MobileShellContext = createContext<MobileShellContextValue>({
  sidebarOpen: false,
  openSidebar: () => {},
  closeSidebar: () => {},
  topBarActions: null,
  setTopBarActions: () => {},
});

export function useMobileShell() {
  return useContext(MobileShellContext);
}

/**
 * Renders its children inside the mobile top app bar (no-op on desktop, where
 * the bar is hidden). Lets a page surface its own controls up there instead of
 * leaving them stranded in the page header on phones.
 */
export function MobileTopBarActions({ children }: { children: ReactNode }) {
  const { setTopBarActions } = useMobileShell();
  useEffect(() => {
    setTopBarActions(children);
    return () => setTopBarActions(null);
  }, [children, setTopBarActions]);
  return null;
}

export function MobileShellProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [topBarActions, setTopBarActions] = useState<ReactNode>(null);

  return (
    <MobileShellContext.Provider
      value={{
        sidebarOpen,
        openSidebar: useCallback(() => setSidebarOpen(true), []),
        closeSidebar: useCallback(() => setSidebarOpen(false), []),
        topBarActions,
        setTopBarActions,
      }}
    >
      {children}
    </MobileShellContext.Provider>
  );
}

/** Primary destinations, mirrored as a native bottom dock on mobile.
 *  Ordered by how often they get opened, with short object-oriented labels. */
const TABS: { label: string; href: string; Glyph: LucideIcon }[] = [
  { label: "Home", href: "analytics", Glyph: BarChart3 },
  { label: "Forms", href: "submissions", Glyph: Send },
  { label: "Funnels", href: "funnels", Glyph: Filter },
  { label: "Events", href: "events", Glyph: Activity },
  { label: "Settings", href: "settings/general", Glyph: SettingsIcon },
];

/** Quick-create shortcuts behind the dock "+" (ClickUp-style). */
const CREATE_ACTIONS = [
  { label: "New funnel", href: "funnels", icon: "funnels" },
  { label: "Add domain", href: "settings/domains", icon: "domains" },
  { label: "API key", href: "settings/api", icon: "api" },
  { label: "UTM template", href: "settings/utm-templates", icon: "links" },
  { label: "Webhook", href: "settings/webhooks", icon: "webhooks" },
];

export function MobileShell({
  children,
  projectSlug,
  projectName,
  projects,
  userEmail,
}: {
  children: ReactNode;
  projectSlug: string;
  projectName: string;
  projects: SidebarProject[];
  userEmail: string;
}) {
  const { sidebarOpen, openSidebar, closeSidebar, topBarActions } = useMobileShell();
  const { openChat } = useChat();
  const t = useMounted(sidebarOpen, 200);
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const createT = useMounted(createOpen, 200);
  const project = projects.find((p) => p.slug === projectSlug);

  // "Today"-style tiles: last 7 days, same hooks the dashboard uses.
  const { projectId } = useProjectId();
  const weekQs = useMemo(() => {
    const to = localInput(new Date(Date.now() + 86400000));
    const from = localInput(new Date(Date.now() - 6 * 86400000));
    return rangeQs(from, to);
  }, []);
  const { data: statsData } = useProjectStats(projectId, weekQs);
  const m = statsData?.metrics;
  const nf = useMemo(() => new Intl.NumberFormat("en"), []);
  const TILES = [
    {
      key: "views",
      label: "Form views",
      icon: "analytics",
      tint: "bg-blue-500/12 text-blue-500",
      value: m ? nf.format(m.views) : "—",
    },
    {
      key: "conv",
      label: "Conversions",
      icon: "check",
      tint: "bg-emerald-500/12 text-emerald-500",
      value: m ? nf.format(m.successes) : "—",
    },
    {
      key: "rate",
      label: "Conv. rate",
      icon: "flash",
      tint: "bg-violet-500/12 text-violet-500",
      value: m ? pct(m.conversionRate) : "—",
    },
    {
      key: "time",
      label: "Avg time",
      icon: "calendar-2",
      tint: "bg-amber-500/12 text-amber-500",
      value: m ? humanMs(m.avgTimeToCompleteMs) : "—",
    },
  ];

  useEffect(() => {
    closeSidebar();
    setCreateOpen(false);
  }, [pathname, closeSidebar]);

  useEffect(() => {
    const locked = sidebarOpen || createOpen;
    document.body.style.overflow = locked ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen, createOpen]);

  return (
    <>
      {/* ── Top app bar (mobile only) ─────────────────────────────── */}
      <header className="trell-mobile-bar fixed inset-x-0 top-0 z-40 md:hidden">
        {/* Row 1: workspace switcher + actions + account */}
        <div className="flex h-14 items-center gap-1 px-3">
          <button
            onClick={openSidebar}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl py-1 text-left active:opacity-80"
            aria-label="Switch workspace"
          >
            {project ? (
              <WorkspaceIcon
                name={project.name}
                variant={project.logoVariant}
                size={28}
                className="shrink-0 rounded-lg"
              />
            ) : (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-[12px] font-medium text-neutral-600">
                {projectName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 truncate text-[17px] font-semibold tracking-tight text-trell-ink">
              {projectName}
            </span>
            <Icon name="arrow-down-01" size={16} className="shrink-0 text-neutral-400" />
          </button>

          {topBarActions}

          <button
            onClick={openSidebar}
            className="flex size-9 shrink-0 items-center justify-center rounded-full active:opacity-80"
            aria-label="Account and workspace menu"
          >
            <span className="relative flex size-8 items-center justify-center rounded-full bg-[#1f1f1f] text-[12px] font-semibold text-white dark:bg-[#CDCCCC] dark:text-[#111111]">
              {(userEmail.charAt(0) || "T").toUpperCase()}
              <span className="absolute -bottom-px -right-px size-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-[#111111]" />
            </span>
          </button>
        </div>

        {/* Row 2: search + filter button */}
        <div className="flex items-center gap-2 px-3 pb-3">
          <button
            type="button"
            onClick={() =>
              document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))
            }
            className="trell-shell-fill flex h-11 flex-1 items-center gap-2.5 rounded-2xl px-3.5 text-left text-[15px] text-neutral-500 active:opacity-90"
          >
            <Search size={18} className="shrink-0 text-neutral-400" />
            Search
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label="Filters and quick actions"
            className="trell-shell-fill flex size-11 shrink-0 items-center justify-center rounded-2xl text-neutral-400 active:opacity-90"
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>

        {/* Row 3: quick tiles (last 7 days) */}
        <div className="scrollbar-hide flex gap-2.5 overflow-x-auto px-3 pb-4">
          {TILES.map((tile, i) => (
            <Link
              key={tile.key}
              href={`/${projectSlug}/analytics`}
              className={`flex w-[150px] shrink-0 flex-col gap-3 rounded-[20px] p-3.5 ring-1 transition-transform active:scale-[0.98] ${
                i === 0
                  ? "bg-[linear-gradient(140deg,#7c5cff,#5b3df0)] text-white ring-white/10"
                  : "trell-shell-tile text-trell-ink ring-black/[0.04] dark:ring-white/[0.06]"
              }`}
            >
              <span
                className={`flex size-10 items-center justify-center rounded-[14px] ${
                  i === 0 ? "bg-white/20 text-white" : `trell-shell-chip ${tile.tint}`
                }`}
              >
                <Icon name={tile.icon} size={20} />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-[19px] font-semibold leading-none">{tile.value}</span>
                <span className={`text-[12px] leading-none ${i === 0 ? "text-white/75" : "text-neutral-500"}`}>
                  {tile.label}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </header>

      {/* ── Drawer: projects, usage, account ──────────────────────── */}
      {t.mounted && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className={`absolute inset-0 bg-black/40 ${t.closing ? "trell-fade-out" : "trell-fade-in"}`}
            onClick={closeSidebar}
          />
          <div
            className={`trell-mobile-drawer absolute inset-y-0 left-0 flex w-[290px] max-w-[86vw] flex-col overflow-hidden bg-neutral-100 py-2 pr-2 ${
              t.closing ? "trell-drawer-left-out" : "trell-drawer-left-in"
            }`}
          >
            <ProjectSidebar
              projectSlug={projectSlug}
              projectName={projectName}
              projects={projects}
              userEmail={userEmail}
            />
          </div>
        </div>
      )}

      {children}

      {/* ── Bottom chrome (mobile only): Yoi pill over the dock ───── */}
      <div className="trell-mobile-dockrow fixed inset-x-0 bottom-0 z-40 px-3 md:hidden">
        <div className="mx-auto flex max-w-md flex-col items-center gap-3">
          {/* Yoi floats above the dock, like ClickUp's "Find" pill. */}
          <button
            type="button"
            onClick={openChat}
            aria-label="Ask Yoi"
            className="trell-mobile-dock flex h-11 items-center gap-2.5 rounded-full pl-1.5 pr-5 text-[15px] font-medium text-trell-ink transition-opacity active:opacity-90"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8b5cf6,#2563eb)] text-white">
              <Icon name="magic-star" size={16} />
            </span>
            Yoi
          </button>

          <div className="flex w-full items-center gap-3">
            <nav
              className="trell-mobile-dock flex flex-1 items-stretch gap-1 rounded-[30px] p-1.5"
              aria-label="Primary"
            >
              {TABS.map(({ label, href, Glyph }) => {
                const active = href.startsWith("settings/")
                  ? pathname.startsWith(`/${projectSlug}/settings`)
                  : pathname.startsWith(`/${projectSlug}/${href}`);
                return (
                  <Link
                    key={href}
                    href={`/${projectSlug}/${href}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-[24px] py-2 text-[11px] transition-colors ${
                      active
                        ? "trell-dock-active font-semibold text-violet-500 dark:text-violet-400"
                        : "font-medium text-neutral-400 active:opacity-70"
                    }`}
                  >
                    <Glyph size={23} strokeWidth={active ? 2.4 : 1.9} />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              aria-label="Create"
              className="trell-mobile-dock flex size-[64px] shrink-0 items-center justify-center rounded-full text-trell-ink transition-opacity active:opacity-70"
            >
              <Plus size={28} strokeWidth={1.6} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick-create sheet (mobile only) ──────────────────────── */}
      {createT.mounted && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className={`absolute inset-0 bg-black/40 ${createT.closing ? "trell-fade-out" : "trell-fade-in"}`}
            onClick={() => setCreateOpen(false)}
          />
          <div
            className={`trell-sheet absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] dark:bg-[#191918] ${
              createT.closing ? "trell-sheet-out" : "trell-sheet-in"
            }`}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-300 dark:bg-white/20" />
            <div className="mb-3 px-1 text-[15px] font-semibold text-trell-ink">Create</div>
            <div className="grid grid-cols-2 gap-2">
              {CREATE_ACTIONS.map((a) => (
                <Link
                  key={a.href}
                  href={`/${projectSlug}/${a.href}`}
                  onClick={() => setCreateOpen(false)}
                  className="flex items-center gap-3 rounded-2xl border border-trell-line px-3 py-3 text-[13px] font-medium text-trell-ink active:bg-black/5 dark:active:bg-white/10"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
                    <Icon name={a.icon} size={18} />
                  </span>
                  {a.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  openChat();
                }}
                className="flex items-center gap-3 rounded-2xl border border-trell-line px-3 py-3 text-[13px] font-medium text-trell-ink active:bg-black/5 dark:active:bg-white/10"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#8b5cf6,#2563eb)] text-white">
                  <Icon name="chat" size={18} />
                </span>
                Ask Yoi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
