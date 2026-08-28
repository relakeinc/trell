"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { Icon } from "@/components/Icon";

interface SidebarProject {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface MobileShellContextValue {
  sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
}

const MobileShellContext = createContext<MobileShellContextValue>({
  sidebarOpen: false,
  openSidebar: () => {},
  closeSidebar: () => {},
});

export function useMobileShell() {
  return useContext(MobileShellContext);
}

export function MobileShellProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <MobileShellContext.Provider
      value={{
        sidebarOpen,
        openSidebar: useCallback(() => setSidebarOpen(true), []),
        closeSidebar: useCallback(() => setSidebarOpen(false), []),
      }}
    >
      {children}
    </MobileShellContext.Provider>
  );
}

export function MobileShell({
  children,
  projectSlug,
  projectName,
  projects,
  userEmail,
  logoVariant = 0,
}: {
  children: ReactNode;
  projectSlug: string;
  projectName: string;
  projects: SidebarProject[];
  userEmail: string;
  logoVariant?: number;
}) {
  const { sidebarOpen, openSidebar, closeSidebar } = useMobileShell();
  const pathname = usePathname();

  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={openSidebar}
        className="fixed left-3 top-3 z-50 flex size-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200 md:hidden"
        aria-label="Open menu"
      >
        <Icon name="menu-01" size={18} />
      </button>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeSidebar} />
          <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col overflow-hidden bg-neutral-100 py-2 pr-2">
            <ProjectSidebar
              projectSlug={projectSlug}
              projectName={projectName}
              projects={projects}
              userEmail={userEmail}
              logoVariant={logoVariant}
            />
          </div>
        </div>
      )}

      {children}
    </>
  );
}
