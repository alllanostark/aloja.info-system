"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Search, BedDouble, Car, X } from "lucide-react";
import { cn, formatEuro } from "@/lib/utils";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { PLATFORM_META, type ActiveAccommodation, type SearchResult } from "@/types";
import type { EditableItem } from "@/lib/combinations";
import { getCombinationSources } from "@/app/(app)/search/[id]/results/combination-actions";
import { useI18n } from "@/lib/i18n";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

type SourceTab = "search" | "active" | "external" | "discarded";

interface PickerItem {
  key: string;
  item: EditableItem;
}

// ─── Mapeamentos para EditableItem ────────────────────────────────────────────

function fromSearchResult(p: SearchResult): EditableItem {
  return {
    key: `${p.status === "discarded" ? "discarded" : "search"}:${p.id}`,
    sourceType: p.status === "discarded" ? "discarded" : "search",
    sourceId: p.id,
    title: p.title,
    address: p.address,
    platform: p.platform,
    furnished: p.furnished ?? true,
    beds: p.num_beds ?? 0,
    driveMinutes: p.drive_minutes,
    monthlyRent: p.total_price ?? 0,
    deposit: p.deposit ?? 0,
    honorarium: p.honorarium ?? 0,
    finalPrice: null,
    externalUrl: p.external_url,
  };
}

function fromAccommodation(a: ActiveAccommodation): EditableItem {
  return {
    key: `${a.status === "external" ? "external" : "active"}:${a.id}`,
    sourceType: a.status === "external" ? "external" : "active",
    sourceId: a.id,
    title: a.address,
    address: a.address,
    platform: null,
    furnished: a.furnished,
    beds: a.total_beds,
    driveMinutes: null,
    monthlyRent: a.monthly_rent ?? 0,
    deposit: a.deposit ?? 0,
    honorarium: a.honorarium ?? 0,
    finalPrice: null,
    externalUrl: null,
  };
}

// ─── Card de imóvel no picker ────────────────────────────────────────────────

function PickerCard({
  item,
  selected,
  onSelect,
}: {
  item: EditableItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();

  const badgeLabel =
    item.platform != null
      ? PLATFORM_META[item.platform].label
      : item.sourceType === "active"
        ? t("combination.picker.sources.active")
        : t("combination.picker.sources.external");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-[var(--radius-lg)] border bg-surface-3 p-4 text-left transition-all duration-150 hover:border-[var(--orange-border)]",
        selected
          ? "border-orange-500 ring-1 ring-orange-500/40"
          : "border-[var(--hairline)]"
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-[var(--radius-sm)] border border-[var(--hairline-medium)] bg-surface-4 px-2 py-0.5 text-[10px] font-medium text-ink-muted">
          {badgeLabel}
        </span>
        {!item.furnished && (
          <span className="rounded-[var(--radius-pill)] border border-[var(--yellow-border)] bg-[var(--yellow-soft)] px-2 py-0.5 text-[10px] font-medium text-yellow-400">
            Precisa Mobilar
          </span>
        )}
      </div>

      <p className="mb-2 truncate text-sm font-medium text-ink">
        {item.title ?? item.address ?? "—"}
      </p>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-subtle">
        <span className="flex items-center gap-1">
          <BedDouble size={12} /> {item.beds}
        </span>
        {item.driveMinutes != null ? (
          <span className="flex items-center gap-1">
            <Car size={12} /> {item.driveMinutes} min
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Car size={12} /> —
          </span>
        )}
        <span className="tabular ml-auto font-medium text-ink">
          {formatEuro(item.finalPrice ?? item.monthlyRent)}/mês
        </span>
      </div>
    </button>
  );
}

// ─── PropertyPicker ───────────────────────────────────────────────────────────

interface PropertyPickerProps {
  searchId: string;
  mode: "swap" | "add";
  excludeKeys: string[];
  onSelect: (item: EditableItem) => void;
  onClose: () => void;
}

export function PropertyPicker({
  searchId,
  mode,
  excludeKeys,
  onSelect,
  onClose,
}: PropertyPickerProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true, onClose);

  const [activeTab, setActiveTab] = useState<SourceTab>("search");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [pools, setPools] = useState<{
    search: EditableItem[];
    discarded: EditableItem[];
    active: EditableItem[];
    external: EditableItem[];
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    startTransition(async () => {
      const sources = await getCombinationSources({ searchId });
      setPools({
        search: sources.searchResults.map(fromSearchResult),
        discarded: sources.discarded.map(fromSearchResult),
        active: sources.activeAccommodations.map(fromAccommodation),
        external: sources.externalAccommodations.map(fromAccommodation),
      });
    });
  }, [searchId]);

  const currentPool = useCallback((): EditableItem[] => {
    if (!pools) return [];
    const raw =
      activeTab === "search"
        ? pools.search
        : activeTab === "discarded"
          ? pools.discarded
          : activeTab === "active"
            ? pools.active
            : pools.external;
    return raw.filter((item) => !excludeKeys.includes(item.key));
  }, [pools, activeTab, excludeKeys]);

  const filtered = useCallback((): EditableItem[] => {
    const q = debouncedQuery.trim().toLowerCase();
    const pool = currentPool();
    if (!q) return pool;
    return pool.filter((item) => {
      const haystack = [item.title, item.address].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [currentPool, debouncedQuery]);

  const visibleItems = filtered();

  function handleConfirm() {
    if (!selectedKey) return;
    const all = pools
      ? [
          ...pools.search,
          ...pools.discarded,
          ...pools.active,
          ...pools.external,
        ]
      : [];
    const found = all.find((i) => i.key === selectedKey);
    if (found) {
      onSelect(found);
      onClose();
    }
  }

  const tabs: { id: SourceTab; label: string }[] = [
    { id: "search", label: t("combination.picker.sources.search") },
    { id: "active", label: t("combination.picker.sources.active") },
    { id: "external", label: t("combination.picker.sources.external") },
    { id: "discarded", label: t("combination.picker.sources.discarded") },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("combination.picker.title")}
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-canvas/80 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        className="relative z-10 flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--hairline-medium)] bg-surface-2"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-4">
          <p className="text-sm font-semibold text-ink">
            {t("combination.picker.title")}
          </p>
          <button
            onClick={onClose}
            aria-label={t("action.close")}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs de fonte */}
        <div className="flex items-center gap-1 border-b border-[var(--hairline)] px-5 pt-3 pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedKey(null);
              }}
              className={cn(
                "cursor-pointer rounded-t-[var(--radius-sm)] px-4 py-2 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "border-b-2 border-orange-500 text-ink"
                  : "text-ink-subtle hover:text-ink-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Barra de busca */}
        <div className="border-b border-[var(--hairline)] px-5 py-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
            />
            <input
              type="text"
              placeholder={t("combination.picker.search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Grid de cards */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isPending || pools === null ? (
            <div className="flex items-center justify-center py-10 text-sm text-ink-subtle">
              {t("state.loading")}
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-ink-subtle">
              {t("combination.picker.empty")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {visibleItems.map((item) => (
                <PickerCard
                  key={item.key}
                  item={item}
                  selected={selectedKey === item.key}
                  onSelect={() =>
                    setSelectedKey((prev) =>
                      prev === item.key ? null : item.key
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--hairline)] px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-[var(--radius-md)] border border-[var(--hairline-medium)] px-3 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
          >
            {t("combination.edit.cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedKey}
            className="rounded-[var(--radius-md)] border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("combination.picker.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
