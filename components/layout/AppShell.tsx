"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, Home as HomeIcon, Layers, Clock } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useI18n } from "@/lib/i18n";
import FloatingLines from "@/components/ui/FloatingLines/FloatingLines";
import Dock from "@/components/ui/Dock/Dock";

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
 * Wrapper client que orquestra o drawer mobile, o fundo animado global
 * (FloatingLines — igual à tela de login) e o Dock de quick actions.
 * Fornece SidebarDrawerContext para que TopBar consiga abrir o drawer.
 */
export function AppShell({ userName, userRole, children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  const openSidebar = useCallback(() => setOpen(true), []);
  const closeSidebar = useCallback(() => setOpen(false), []);

  const dockItems = [
    {
      icon: <Search size={20} strokeWidth={1.75} />,
      label: t("dock.new_search"),
      onClick: () => router.push("/search"),
    },
    {
      icon: <UserPlus size={20} strokeWidth={1.75} />,
      label: t("dock.add_contact"),
      onClick: () => router.push("/contacts?new=1"),
    },
    {
      icon: <HomeIcon size={20} strokeWidth={1.75} />,
      label: t("dock.add_external"),
      onClick: () => router.push("/accommodations?tab=external&new=1"),
    },
    {
      icon: <Layers size={20} strokeWidth={1.75} />,
      label: t("dock.compositions"),
      onClick: () => router.push("/history?tab=combinations"),
    },
    {
      icon: <Clock size={20} strokeWidth={1.75} />,
      label: t("dock.recent_history"),
      onClick: () => router.push("/history"),
    },
  ];

  return (
    <SidebarDrawerContext.Provider value={{ open, openSidebar, closeSidebar }}>
      {/* Fundo animado global — mesmas linhas Sparks da tela de login.
          mixBlendMode "screen" anula o fundo preto do canvas WebGL. */}
      <div aria-hidden className="fixed inset-0 z-0 opacity-30">
        <FloatingLines
          linesGradient={["#fdb06a", "#f97316", "#ea6c0a"]}
          lineCount={4}
          lineDistance={9}
          animationSpeed={0.3}
          interactive
          parallax
          mixBlendMode="screen"
        />
      </div>

      <div className="relative z-10 flex h-screen overflow-hidden">
        <Sidebar
          userName={userName}
          userRole={userRole}
          open={open}
          onClose={closeSidebar}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>

        {/* Dock — quick actions persistente (desktop). Sidebar continua
            sendo a navegação primária. Oculto em mobile (drawer já basta). */}
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 hidden justify-center md:flex">
          <div className="pointer-events-auto">
            <Dock
              items={dockItems}
              baseItemSize={44}
              magnification={62}
              panelHeight={62}
              distance={160}
              dockHeight={120}
            />
          </div>
        </div>
      </div>
    </SidebarDrawerContext.Provider>
  );
}
