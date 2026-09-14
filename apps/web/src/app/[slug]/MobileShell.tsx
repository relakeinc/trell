"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { Icon } from "@/components/Icon";
import { WorkspaceIcon } from "@/components/WorkspaceIcon";
import { useMounted } from "@/components/Transitions";
import { useChat } from "@/components/ChatProvider";

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

/** Primary destinations, mirrored as a native bottom tab bar on mobile. */
const TABS = [
  { label: "Analytics", href: "analytics", icon: "analytics" },
  { label: "Funnels", href: "funnels", icon: "funnels" },
  { label: "Events", href: "events", icon: "events" },
  { label: "Forms", href: "submissions", icon: "send" },
  { label: "Settings", href: "settings/general", icon: "setting-2" },
];

function sectionTitle(pathname: string, slug: string): string {
  if (pathname.includes(`/${slug}/settings`)) return "Settings";
  const tab = TABS.find((t) => pathname.startsWith(`/${slug}/${t.href}`));
  return tab?.label ?? "Analytics";
}

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
  const project = projects.find((p) => p.slug === projectSlug);
  const title = sectionTitle(pathname, projectSlug);

  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <>
      {/* ── Top app bar (mobile only) ─────────────────────────────── */}
      <header className="trell-mobile-bar fixed inset-x-0 top-0 z-40 md:hidden">
        <div className="flex h-14 items-center gap-2 px-2">
          <button
            onClick={openSidebar}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-neutral-600 active:bg-neutral-100"
            aria-label="Open menu"
          >
            <Icon name="menu-01" size={20} />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-trell-ink">{title}</h1>
          {topBarActions}
          <button
            onClick={openSidebar}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl active:bg-neutral-100"
            aria-label="Switch project"
          >
            {project ? (
              <WorkspaceIcon name={project.name} variant={project.logoVariant} size={26} className="rounded-lg" />
            ) : (
              <span className="flex size-6 items-center justify-center rounded-lg bg-neutral-200 text-[11px] font-medium text-neutral-600">
                {projectName.charAt(0).toUpperCase()}
              </span>
            )}
          </button>
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

      {/* ── Bottom dock (mobile only): tabs + Yoi, one row ────────── */}
      <div className="trell-mobile-dockrow fixed inset-x-0 bottom-0 z-40 px-3 md:hidden">
        <div className="mx-auto flex max-w-md items-stretch gap-2">
          <nav className="trell-mobile-dock flex flex-1 items-stretch rounded-[22px] p-1" aria-label="Primary">
            {TABS.map((tab) => {
              const active = tab.href.startsWith("settings/")
                ? pathname.startsWith(`/${projectSlug}/settings`)
                : pathname.startsWith(`/${projectSlug}/${tab.href}`);
              return (
                <Link
                  key={tab.href}
                  href={`/${projectSlug}/${tab.href}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-medium transition-colors ${
                    active
                      ? "bg-blue-500/10 text-blue-600"
                      : "text-neutral-400 active:bg-black/5 dark:active:bg-white/10"
                  }`}
                >
                  <Icon name={tab.icon} size={21} strokeWidth={active ? 2.1 : 1.6} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={openChat}
            aria-label="Ask Yoi"
            className="trell-mobile-dock flex w-[67px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[22px] p-1 text-[10px] font-medium text-neutral-400 transition-colors active:bg-black/5 dark:active:bg-white/10"
          >
            <Icon name="chat" size={21} strokeWidth={1.6} />
            Ask
          </button>
        </div>
      </div>
    </>
  );
}
