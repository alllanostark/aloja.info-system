"use client";

import { usePathname } from "next/navigation";
import { Globe, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, type Locale, type TranslationKey } from "@/lib/i18n";
import { useSidebarDrawer } from "@/components/layout/AppShell";

const LOCALES: { value: Locale; label: string }[] = [
  { value: "pt", label: "PT" },
  { value: "es", label: "ES" },
];

// Mapeia pathname -> chave de tradução do título
const ROUTE_TITLE_KEY: Record<string, TranslationKey> = {
  "/dashboard": "page.dashboard",
  "/search": "page.search",
  "/accommodations": "page.accommodations",
  "/history": "page.history",
};

function resolveRouteKey(pathname: string): TranslationKey | null {
  // Match exato: evita que /search/<id>/results faça match greedy com /search
  // e mostre "Nova Busca" em vez do título próprio passado pela sub-rota.
  return ROUTE_TITLE_KEY[pathname] ?? null;
}

export function TopBar({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  const { locale, setLocale, t } = useI18n();
  const pathname = usePathname();
  const { openSidebar } = useSidebarDrawer();

  const routeKey = resolveRouteKey(pathname);
  const displayTitle = routeKey ? t(routeKey) : title;

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[var(--hairline)] bg-[var(--glass-bg)] px-4 backdrop-blur-xl md:px-8">
      <div className="flex items-center gap-3">
        {/* Hamburger — apenas mobile */}
        <button
          type="button"
          onClick={openSidebar}
          aria-label="Abrir menu de navegação"
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink md:hidden"
        >
          <Menu size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>

        <h1 className="text-sm font-medium text-ink-muted">{displayTitle}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Toggle PT / ES */}
        <div
          role="group"
          aria-label={t("lang.label")}
          className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-1 p-1"
        >
          <Globe
            size={14}
            strokeWidth={1.5}
            className="ml-1 mr-0.5 shrink-0 text-ink-subtle"
            aria-hidden="true"
          />
          {LOCALES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setLocale(value)}
              aria-pressed={locale === value}
              aria-label={value === "pt" ? "Português" : "Español"}
              className={cn(
                "tabular cursor-pointer rounded-[var(--radius-sm)] px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors duration-150",
                locale === value
                  ? "bg-surface-3 text-ink"
                  : "text-ink-subtle hover:text-ink-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {action}
      </div>
    </header>
  );
}
