"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Users, ChevronRight, SearchX, Search } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Search as SearchModel } from "@/types";

const STATUS_MAP: Record<
  SearchModel["status"],
  { variant: "pending" | "approved" | "rejected"; label: string }
> = {
  active: { variant: "pending", label: "Ativa" },
  completed: { variant: "approved", label: "Concluída" },
  abandoned: { variant: "rejected", label: "Abandonada" },
};

export function RecentSearches({ searches }: { searches: SearchModel[] }) {
  const [query, setQuery] = useState("");

  if (searches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] bg-surface-1 px-6 py-12 text-center">
        <SearchX size={28} strokeWidth={1.5} className="text-ink-subtle" />
        <p className="mt-3 text-sm font-medium text-ink-muted">
          Ainda não há buscas
        </p>
        <p className="mt-1 text-sm text-ink-subtle">
          Inicia a primeira busca de alojamento para uma obra.
        </p>
        <Link
          href="/search"
          className="mt-4 rounded-[var(--radius-md)] btn-glass-accent px-3.5 py-2 text-sm font-medium"
        >
          Nova Busca
        </Link>
      </div>
    );
  }

  const filtered = searches.filter((s) => {
    const q = query.toLowerCase();
    return (
      (s.obra_name ?? "").toLowerCase().includes(q) ||
      s.obra_address.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Filtro */}
      <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-2 px-3 py-2 transition-colors focus-within:border-[var(--hairline-medium)]">
        <Search size={14} strokeWidth={1.5} className="shrink-0 text-ink-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar buscas..."
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
        />
      </div>

      {filtered.length === 0 && query !== "" ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] bg-surface-1 px-6 py-8 text-center text-sm text-ink-subtle">
          Nenhuma busca com “{query}”
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-1">
          {filtered.map((s, i) => {
            const status = STATUS_MAP[s.status];
            return (
              <Link
                key={s.id}
                href={`/search/${s.id}/results`}
                className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2 ${
                  i > 0 ? "border-t border-[var(--hairline)]" : ""
                }`}
              >
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2">
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
                  <div className="mt-1 flex items-center gap-4 text-xs text-ink-subtle">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} strokeWidth={1.5} />
                      <span className="truncate">{s.obra_address}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} strokeWidth={1.5} />
                      {s.num_workers} trabalhadores
                    </span>
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
