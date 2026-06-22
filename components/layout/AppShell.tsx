"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

// ── Contexto do drawer mobile ─────────────────────────────────────────────────

interface SidebarDrawerContextValue {
  open: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
}

const SidebarDrawerContext = createContext<SidebarDrawerContextValue | null>(null);

export function useSidebarDrawer(): SidebarDrawerContextValue {
  const ctx = useContext(SidebarDrawerContext);
  if (!ctx) {
    throw new Error("useSidebarDrawer deve ser usado dentro de <AppShell>");
  }
  return ctx;
}

// ── AppShell ──────────────────────────────────────────────────────────────────

interface AppShellProps {
  userName: string;
  userRole: string;
  children: React.ReactNode;
}

/**
 * Wrapper client que orquestra o drawer mobile.
 * Fornece SidebarDrawerContext para que TopBar (renderizado nas páginas)
 * consiga abrir o drawer sem prop drilling.
 */
export function AppShell({ userName, userRole, children }: AppShellProps) {
  const [open, setOpen] = useState(false);

  const openSidebar = useCallback(() => setOpen(true), []);
  const closeSidebar = useCallback(() => setOpen(false), []);

  return (
    <SidebarDrawerContext.Provider value={{ open, openSidebar, closeSidebar }}>
      <div className="flex h-screen overflow-hidden bg-canvas">
        <Sidebar
          userName={userName}
          userRole={userRole}
          open={open}
          onClose={closeSidebar}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </SidebarDrawerContext.Provider>
  );
}
