"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  MapPin,
  Users,
  ChevronRight,
  SearchX,
  Search,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { formatEuro } from "@/lib/utils";
import type { Search as SearchType, SearchStatus } from "@/types";

const STATUS_MAP: Record<
  SearchStatus,
  { variant: "pending" | "approved" | "rejected"; label: string }
> = {
  active: { variant: "pending", label: "Ativa" },
  completed: { variant: "approved", label: "Concluída" },
  abandoned: { variant: "rejected", label: "Abandonada" },
};

const FILTER_OPTIONS: { value: "all" | SearchStatus; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Ativas" },
  { value: "completed", label: "Concluídas" },
  { value: "abandoned", label: "Abandonadas" },
];

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function SearchHistoryList({ searches }: { searches: SearchType[] }) {
  const [statusFilter, setStatusFilter] = useState<"all" | SearchStatus>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return searches.filter((s) => {
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      const haystack = `${s.obra_name ?? ""} ${s.obra_address}`.toLowerCase();
      const matchQuery = query.trim() === "" || haystack.includes(query.toLowerCase().trim());
      return matchStatus && matchQuery;
    });
  }, [searches, statusFilter, query]);

  if (searches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] bg-surface-1 px-6 py-16 text-center">
        <SearchX size={28} strokeWidth={1.5} className="text-ink-subtle" />
        <p className="mt-3 text-sm font-medium text-ink-muted">
          Ainda não há buscas registadas
        </p>
        <p className="mt-1 text-sm text-ink-subtle">
          As buscas de alojamento aparecerão aqui assim que forem criadas.
        </p>
        <Link
          href="/search"
          className="mt-4 rounded-[var(--radius-md)] bg-orange-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-400"
        >
          Nova Busca
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-2 p-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                "cursor-pointer rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-all duration-150",
                statusFilter === opt.value
                  ? "bg-surface-4 text-ink shadow-[var(--shadow-xs)]"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <Search
            size={14}
            strokeWidth={1.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por cidade ou obra…"
            className={cn(
              "w-full rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-2",
              "py-2 pl-8 pr-4 text-sm text-ink placeholder:text-ink-subtle",
              "transition-colors focus:border-[var(--hairline-medium)] focus:outline-none"
            )}
          />
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] bg-surface-1 px-6 py-12 text-center">
          <SearchX size={24} strokeWidth={1.5} className="text-ink-subtle" />
          <p className="mt-3 text-sm text-ink-muted">
            Nenhuma busca corresponde aos filtros.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-1">
          {filtered.map((s, i) => {
            const status = STATUS_MAP[s.status];
            return (
              <Link
                key={s.id}
                href={`/search/${s.id}/results`}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2",
                  i > 0 && "border-t border-[var(--hairline)]"
                )}
              >
                <div className="flex-1 overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">
                      {s.obra_name ?? s.obra_address}
                    </span>
                    <StatusBadge variant={status.variant} label={status.label} />
                    {s.is_demo && (
                      <span className="rounded-[var(--radius-sm)] border border-[var(--red-border)] bg-[var(--red-soft)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-400">
                        Demo
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} strokeWidth={1.5} />
                      <span className="truncate">{s.obra_address}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} strokeWidth={1.5} />
                      {s.num_workers} trabalhadores
                    </span>
                    <span className="tabular">
                      {formatEuro(s.budget_per_person)}/pessoa
                    </span>
                    <span>{formatDate(s.created_at)}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-ink-subtle" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
