"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard,
  Search,
  Building2,
  History,
  LogOut,
  Home,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useFocusTrap } from "@/lib/useFocusTrap";

const NAV: { href: string; key: TranslationKey; icon: React.ElementType }[] = [
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/search", key: "nav.search", icon: Search },
  { href: "/accommodations", key: "nav.accommodations", icon: Building2 },
  { href: "/contacts", key: "nav.contacts", icon: UsersRound },
  { href: "/history", key: "nav.history", icon: History },
];

interface SidebarProps {
  userName: string;
  userRole: string;
  /** Mobile drawer: se o painel está aberto. Ignorado em md+. */
  open?: boolean;
  /** Chamado quando o overlay ou Escape fecha o drawer. */
  onClose?: () => void;
}

export function Sidebar({ userName, userRole, open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const drawerRef = useRef<HTMLElement>(null);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Fecha o drawer ao navegar (pathname muda)
  useEffect(() => {
    handleClose();
  }, [pathname, handleClose]);

  // Trap de foco + Escape apenas quando o drawer está aberto em mobile
  useFocusTrap(drawerRef, open, handleClose);

  return (
    <>
      {/* Overlay — só visible em mobile quando open */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        className={cn(
          "fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-200 md:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Painel lateral */}
      <aside
        ref={drawerRef}
        className={cn(
          // Desktop: fixo na coluna, sem transformações
          "flex h-screen w-60 flex-col border-r border-[var(--border-glass)] bg-[var(--glass-bg)] backdrop-blur-2xl",
          // Mobile: drawer fixo com translate controlado por `open`
          "fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-in-out",
          "md:relative md:translate-x-0 md:z-auto md:transition-none",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] bg-[var(--orange-soft)]">
            <Home size={16} strokeWidth={2} className="text-orange-500" />
          </div>
          <span className="text-base font-semibold tracking-display text-ink">
            Sparks Aloja
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 px-3 pt-4">
          <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
            {t("nav.section")}
          </div>
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-all duration-150",
                  active
                    ? "bg-surface-3 text-ink"
                    : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-orange-500" />
                )}
                <Icon
                  size={18}
                  strokeWidth={1.5}
                  className={cn(
                    "transition-colors",
                    active
                      ? "text-orange-500"
                      : "text-ink-subtle group-hover:text-ink-muted"
                  )}
                />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>

        {/* Footer / user */}
        <div className="border-t border-[var(--hairline)] p-3">
          <div className="flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-4 text-sm font-medium text-ink">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="truncate text-sm font-medium text-ink">
                {userName}
              </div>
              <div className="truncate text-xs capitalize text-ink-subtle">
                {userRole === "admin" ? t("nav.role.admin") : t("nav.role.viewer")}
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                aria-label={t("nav.logout")}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-ink-subtle transition-colors hover:bg-surface-3 hover:text-red-400"
              >
                <LogOut size={16} strokeWidth={1.5} />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
