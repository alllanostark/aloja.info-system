"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { UsersRound, Plus, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { ContactCard } from "./ContactCard";
import { AddContactForm } from "./AddContactForm";
import { ImportAgenciesButton } from "./ImportAgenciesButton";
import type { Contact, ContactRating } from "@/types";

// RATING_FILTERS agora é gerado dentro do componente via t()

function stripDigits(s: string) {
  return s.replace(/\D/g, "");
}

export function ContactsList({
  contacts,
  isAdmin,
  linkedCounts,
  highlightId,
}: {
  contacts: Contact[];
  isAdmin: boolean;
  linkedCounts?: Record<string, number>;
  highlightId?: string;
}) {
  const { t } = useI18n();

  const ratingFilters: { value: "all" | ContactRating; label: string }[] = [
    { value: "all", label: t("contacts.rating.all") },
    { value: "good", label: t("contacts.rating.good") },
    { value: "neutral", label: t("contacts.rating.neutral") },
    { value: "bad", label: t("contacts.rating.bad") },
  ];

  const [ratingFilter, setRatingFilter] = useState<"all" | ContactRating>("all");
  const [cityQuery, setCityQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const cities = useMemo(() => {
    const set = new Set(contacts.map((c) => c.city).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qDigits = stripDigits(searchQuery.trim());

    return contacts.filter((c) => {
      const matchRating = ratingFilter === "all" || c.rating === ratingFilter;
      const matchCity =
        cityQuery.trim() === "" ||
        (c.city ?? "").toLowerCase().includes(cityQuery.toLowerCase().trim());

      let matchSearch = true;
      if (q.length > 0) {
        const nameMatch = c.name.toLowerCase().includes(q);
        const companyMatch = (c.company ?? "").toLowerCase().includes(q);
        const emailMatch = (c.email ?? "").toLowerCase().includes(q);
        const phoneMatch =
          qDigits.length > 0 &&
          stripDigits(c.phone ?? "").includes(qDigits);
        matchSearch = nameMatch || companyMatch || emailMatch || phoneMatch;
      }

      return matchRating && matchCity && matchSearch;
    });
  }, [contacts, ratingFilter, cityQuery, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Toolbar linha 1 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Busca livre */}
        <label className="sr-only" htmlFor="contacts-search">
          {t("contacts.search.placeholder")}
        </label>
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
            aria-hidden="true"
          />
          <input
            id="contacts-search"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("contacts.search.placeholder")}
            aria-label={t("contacts.search.placeholder")}
            className={cn(
              "w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3",
              "px-3.5 py-2.5 pl-8 text-sm text-ink placeholder:text-ink-subtle",
              "focus:border-orange-500 focus:outline-none transition-colors"
            )}
          />
        </div>

        {/* Filtro cidade */}
        <div className="relative min-w-[160px]">
          {cities.length > 3 ? (
            <>
              <Search
                size={14}
                strokeWidth={1.5}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
                aria-hidden="true"
              />
              <input
                type="text"
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                placeholder={t("contacts.city.placeholder")}
                aria-label={t("contacts.city.placeholder")}
                className={cn(
                  "w-full rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-2",
                  "py-2.5 pl-8 pr-4 text-sm text-ink placeholder:text-ink-subtle",
                  "focus:border-[var(--hairline-medium)] focus:outline-none transition-colors"
                )}
              />
            </>
          ) : (
            <>
              <SlidersHorizontal
                size={14}
                strokeWidth={1.5}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
                aria-hidden="true"
              />
              <select
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                aria-label={t("contacts.city.placeholder")}
                className={cn(
                  "w-full cursor-pointer rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-2",
                  "py-2.5 pl-8 pr-4 text-sm text-ink",
                  "focus:border-[var(--hairline-medium)] focus:outline-none transition-colors"
                )}
              >
                <option value="">{t("contacts.city.all")}</option>
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
              {showForm ? t("contacts.cancel") : t("contacts.add")}
            </button>
          </>
        )}
      </div>

      {/* Toolbar linha 2 — chips de rating */}
      <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-2 p-1 w-fit">
        {ratingFilters.map((opt) => (
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

      {/* Formulário */}
      {showForm && isAdmin && (
        <AddContactForm onClose={() => setShowForm(false)} />
      )}

      {/* Grid ou empty state */}
      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] bg-surface-1 px-6 py-16 text-center">
          <UsersRound size={28} strokeWidth={1.5} className="text-ink-subtle" />
          <p className="mt-3 text-sm font-medium text-ink-muted">
            {t("contacts.empty.title")}
          </p>
          <p className="mt-1 text-sm text-ink-subtle">
            {t("contacts.empty.sub")}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] bg-surface-1 px-6 py-12 text-center">
          <UsersRound size={24} strokeWidth={1.5} className="text-ink-subtle" />
          <p className="mt-3 text-sm text-ink-muted">
            {t("contacts.filtered.empty")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              isAdmin={isAdmin}
              linkedCount={linkedCounts?.[contact.id] ?? 0}
              highlighted={highlightId === contact.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
