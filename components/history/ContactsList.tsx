"use client";

import { useState, useMemo } from "react";
import { UsersRound, Plus, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContactCard } from "./ContactCard";
import { AddContactForm } from "./AddContactForm";
import { ImportAgenciesButton } from "./ImportAgenciesButton";
import type { Contact, ContactRating } from "@/types";

const RATING_FILTERS: { value: "all" | ContactRating; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "good", label: "Bons" },
  { value: "neutral", label: "Neutros" },
  { value: "bad", label: "Maus" },
];

export function ContactsList({
  contacts,
  isAdmin,
}: {
  contacts: Contact[];
  isAdmin: boolean;
}) {
  const [ratingFilter, setRatingFilter] = useState<"all" | ContactRating>("all");
  const [cityQuery, setCityQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

  const cities = useMemo(() => {
    const set = new Set(contacts.map((c) => c.city).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      const matchRating = ratingFilter === "all" || c.rating === ratingFilter;
      const matchCity =
        cityQuery.trim() === "" ||
        (c.city ?? "").toLowerCase().includes(cityQuery.toLowerCase().trim());
      return matchRating && matchCity;
    });
  }, [contacts, ratingFilter, cityQuery]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filtro rating */}
        <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-2 p-1">
          {RATING_FILTERS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRatingFilter(opt.value)}
              className={cn(
                "cursor-pointer rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-all duration-150",
                ratingFilter === opt.value
                  ? "bg-surface-4 text-ink shadow-[var(--shadow-xs)]"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Filtro cidade */}
        <div className="relative flex-1 min-w-[160px]">
          <Search
            size={14}
            strokeWidth={1.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          {cities.length > 3 ? (
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder="Filtrar por cidade…"
              className={cn(
                "w-full rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-2",
                "py-2 pl-8 pr-4 text-sm text-ink placeholder:text-ink-subtle",
                "focus:border-[var(--hairline-medium)] focus:outline-none"
              )}
            />
          ) : (
            <>
              <SlidersHorizontal
                size={14}
                strokeWidth={1.5}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
              />
              <select
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                className={cn(
                  "w-full cursor-pointer rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-2",
                  "py-2 pl-8 pr-4 text-sm text-ink",
                  "focus:border-[var(--hairline-medium)] focus:outline-none"
                )}
              >
                <option value="">Todas as cidades</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Ações admin */}
        {isAdmin && (
          <>
            <ImportAgenciesButton />
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-3.5 py-2 text-sm font-medium",
                "transition-all duration-150 active:scale-[0.99]",
                showForm
                  ? "bg-surface-4 text-ink-muted hover:text-ink"
                  : "bg-orange-500 text-white hover:bg-orange-400"
              )}
            >
              <Plus size={16} strokeWidth={2} />
              {showForm ? "Cancelar" : "Adicionar Contacto"}
            </button>
          </>
        )}
      </div>

      {/* Formulário */}
      {showForm && isAdmin && (
        <AddContactForm onClose={() => setShowForm(false)} />
      )}

      {/* Grid ou empty state */}
      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] bg-surface-1 px-6 py-16 text-center">
          <UsersRound size={28} strokeWidth={1.5} className="text-ink-subtle" />
          <p className="mt-3 text-sm font-medium text-ink-muted">
            Sem contactos na base de dados
          </p>
          <p className="mt-1 text-sm text-ink-subtle">
            Adiciona proprietários e agências para os encontrares facilmente em buscas futuras.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] bg-surface-1 px-6 py-12 text-center">
          <UsersRound size={24} strokeWidth={1.5} className="text-ink-subtle" />
          <p className="mt-3 text-sm text-ink-muted">
            Nenhum contacto corresponde aos filtros.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((contact) => (
            <ContactCard key={contact.id} contact={contact} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}
