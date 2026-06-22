"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchHistoryList } from "./SearchHistoryList";
import type { Search } from "@/types";

type Tab = "searches";

const TABS: { id: Tab; label: string; icon: typeof History }[] = [
  { id: "searches", label: "Buscas", icon: History },
];

export function HistoryTabs({
  searches,
  isAdmin,
  stats,
}: {
  searches: Search[];
  isAdmin: boolean;
  stats: { total: number; completed: number; active: number };
}) {
  const [active, setActive] = useState<Tab>("searches");

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-2 p-1 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium",
                "transition-all duration-150",
                active === tab.id
                  ? "bg-surface-4 text-ink shadow-[var(--shadow-xs)]"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              <Icon size={16} strokeWidth={1.5} />
              {tab.label}
              <span
                className={cn(
                  "rounded-[var(--radius-pill)] px-1.5 py-0.5 text-[10px] font-semibold tabular",
                  active === tab.id
                    ? "bg-surface-5 text-ink-muted"
                    : "bg-surface-3 text-ink-subtle"
                )}
              >
                {searches.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contadores */}
      {active === "searches" && (
        <div className="flex flex-wrap items-center gap-6">
          <Stat label="Total" value={stats.total} />
          <Stat label="Concluídas" value={stats.completed} accent="green" />
          <Stat label="Ativas" value={stats.active} accent="orange" />
        </div>
      )}

      {/* Conteúdo */}
      {active === "searches" && <SearchHistoryList searches={searches} />}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "green" | "orange";
}) {
  const valueClass =
    accent === "green"
      ? "text-green-400"
      : accent === "orange"
        ? "text-orange-500"
        : "text-ink";

  return (
    <div className="flex items-baseline gap-2">
      <span className={cn("text-2xl font-bold tabular tracking-display", valueClass)}>
        {value}
      </span>
      <span className="text-sm text-ink-subtle">{label}</span>
    </div>
  );
}
