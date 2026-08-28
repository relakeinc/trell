"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

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
