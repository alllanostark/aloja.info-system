"use client";

import { useState, useTransition } from "react";
import { AnimatePresence } from "framer-motion";
import { Layers, Building2, Trash2 } from "lucide-react";
import { cn, formatEuro } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { deleteCombination } from "@/app/(app)/search/[id]/results/combination-actions";
import type { CombinationSourceType } from "@/types";
import type { CombinationFinancials } from "@/lib/combinations";
import { SavedCombinationModal } from "./SavedCombinationModal";

// Item de uma composição salva, já achatado a partir de combination_items
// (apenas os overrides — é o que persiste no banco para composições guardadas).
export interface SavedCombinationItem {
  id: string;
  sourceType: CombinationSourceType;
  sourceId: string | null;
  title: string | null;
  beds: number;
  driveMinutes: number | null;
  monthlyRent: number;
  deposit: number;
  honorarium: number;
  finalPrice: number | null;
  position: number;
}

export interface CombinationSummary {
  id: string;
  label: string;
  obraName: string | null;
  itemCount: number;
  netCost: number;
  durationValue: number;
  durationUnit: "months" | "weeks" | "days";
  // ── Campos para o modal de visualização (populados server-side) ──
  notes: string | null;
  workersNeeded: number;
  items: SavedCombinationItem[];
  financials: CombinationFinancials;
}

function CombinationCard({
  combo,
  isAdmin,
  onOpen,
}: {
  combo: CombinationSummary;
  isAdmin: boolean;
  onOpen: (combo: CombinationSummary) => void;
}) {
  const { t } = useI18n();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  // stopPropagation: o card inteiro é clicável (abre o modal); o delete
  // não pode disparar essa abertura.
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      await deleteCombination({ id: combo.id });
    });
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${t("history.combination.viewDetails")}: ${combo.label}`}
      onClick={() => onOpen(combo)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(combo);
        }
      }}
      className="cursor-pointer rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-2 p-5 transition-all duration-200 hover:border-[var(--hairline-medium)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <Layers size={15} strokeWidth={1.5} className="shrink-0 text-orange-400" />
          <span className="truncate text-sm font-semibold text-ink">{combo.label}</span>
        </div>
        {isAdmin && (
          <button
            onClick={handleDelete}
            disabled={isPending}
            aria-label={confirmDelete ? t("history.combination.deleteConfirm") : t("action.delete")}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-1 text-[11px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
              confirmDelete
                ? "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                : "border-[var(--hairline-medium)] bg-surface-3 text-ink-subtle hover:border-red-500/40 hover:text-red-400"
            )}
          >
            <Trash2 size={11} strokeWidth={1.5} />
            {confirmDelete ? t("history.combination.deleteConfirm") : ""}
          </button>
        )}
      </div>

      {combo.obraName && (
        <div className="mb-3 flex items-center gap-1.5 text-xs text-ink-subtle">
          <Building2 size={12} strokeWidth={1.5} />
          <span className="truncate">{combo.obraName}</span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
        <span>
          {combo.itemCount}{" "}
          {combo.itemCount === 1
            ? t("history.combination.property")
            : t("history.combination.properties")}
        </span>
        <span className="text-[var(--hairline-medium)]">·</span>
        <span>
          {combo.durationValue}{" "}
          {combo.durationUnit === "months"
            ? t("combination.duration.months")
            : combo.durationUnit === "weeks"
              ? t("combination.duration.weeks")
              : t("combination.duration.days")}
        </span>
      </div>

      <div className="border-t border-[var(--hairline)] pt-3">
        <p className="mb-0.5 text-[10px] uppercase tracking-wider text-ink-subtle">{t("history.combination.netCost")}</p>
        <p className="tabular text-lg font-bold text-ink">{formatEuro(combo.netCost)}</p>
      </div>
    </div>
  );
}

export function CombinationsList({
  combinations,
  isAdmin,
}: {
  combinations: CombinationSummary[];
  isAdmin: boolean;
}) {
  const { t } = useI18n();
  const [active, setActive] = useState<CombinationSummary | null>(null);

  if (combinations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-[var(--hairline-medium)] bg-surface-2 py-16 px-8 text-center">
        <Layers size={32} strokeWidth={1} className="mb-4 text-ink-subtle" />
        <p className="text-sm text-ink-subtle">{t("history.tabs.combinationsEmpty")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {combinations.map((combo) => (
          <CombinationCard
            key={combo.id}
            combo={combo}
            isAdmin={isAdmin}
            onOpen={setActive}
          />
        ))}
      </div>

      <AnimatePresence>
        {active && (
          <SavedCombinationModal
            combination={active}
            onClose={() => setActive(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
