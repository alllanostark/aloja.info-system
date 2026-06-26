"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import {
  Layers,
  BookmarkCheck,
  BedDouble,
  Car,
  X,
  Pencil,
  Clock,
} from "lucide-react";
import { cn, formatEuro } from "@/lib/utils";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import type { CombinationSourceType } from "@/types";
import type { CombinationSummary } from "./CombinationsList";

// sourceType → chave i18n do badge curto
const SOURCE_LABEL_KEY: Record<CombinationSourceType, TranslationKey> = {
  search: "history.combination.source.search",
  active: "history.combination.source.active",
  external: "history.combination.source.external",
  discarded: "history.combination.source.discarded",
  manual: "history.combination.source.manual",
};

/**
 * Modal read-only de visualização de uma composição salva. Espelha o layout
 * financeiro do CombinationModal (results): a Ingrid clica num card do
 * histórico e vê items + duração + visão financeira + nota.
 *
 * O botão "Editar" (onEdit) reabre a composição no editor completo
 * (CombinationModal reidratado via initialItems + initialOverrideId), que
 * persiste as alterações com replace_combination.
 */
export function SavedCombinationModal({
  combination,
  onClose,
  onEdit,
}: {
  combination: CombinationSummary;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true, onClose);

  const { financials: fin, items } = combination;

  const unitLabel =
    combination.durationUnit === "months"
      ? t("combination.duration.months")
      : combination.durationUnit === "weeks"
        ? t("combination.duration.weeks")
        : t("combination.duration.days");

  // Aluguel pago 1× na entrada (sem multiplicar pelos meses) — breakdown do
  // ingresso inicial, igual ao modal de edição.
  const firstMonthRent = items.reduce(
    (s, it) => s + (it.finalPrice ?? it.monthlyRent),
    0
  );

  const bedsWord = t("combination.field.beds").toLowerCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-combination-title"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Painel */}
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="glass-panel relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-xl)] p-6"
      >
        {/* ── Header ── */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Layers size={18} strokeWidth={1.5} className="shrink-0 text-orange-400" />
            <h3
              id="saved-combination-title"
              className="truncate text-lg font-semibold text-ink"
            >
              {combination.label}
            </h3>
            <span className="flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--orange-border)] bg-[var(--orange-soft)] px-2 py-0.5 text-[11px] font-medium text-orange-400">
              <BookmarkCheck size={12} strokeWidth={1.75} />
              {t("history.combination.badge.saved")}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label={t("action.close")}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {combination.obraName && (
          <p className="mb-5 -mt-2 truncate text-xs text-ink-subtle">
            {combination.obraName}
          </p>
        )}

        {/* ── Bloco 1 — Lista de inmuebles ── */}
        <div className="mb-5 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-3 p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-[var(--radius-sm)] border border-[var(--hairline-medium)] bg-surface-4 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                  {t(SOURCE_LABEL_KEY[item.sourceType])}
                </span>
              </div>

              <p className="text-sm font-medium text-ink">
                {item.title ?? t("history.combination.itemUntitled")}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-subtle">
                <span className="flex items-center gap-1">
                  <BedDouble size={13} /> {item.beds} {bedsWord}
                </span>
                <span className="flex items-center gap-1">
                  <Car size={13} />{" "}
                  {item.driveMinutes != null ? `${item.driveMinutes} min` : "—"}
                </span>
                <span className="tabular text-ink-muted">
                  {formatEuro(item.finalPrice ?? item.monthlyRent)}
                  {t("combination.card.perMonth")}
                  {item.finalPrice != null && (
                    <span className="ml-1 text-orange-400">
                      ({t("combination.card.negotiated")})
                    </span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Bloco 2 — Duração (read-only) ── */}
        <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-1 px-4 py-3">
          <Clock size={15} strokeWidth={1.5} className="text-ink-subtle" />
          <span className="text-[11px] uppercase tracking-wider text-ink-subtle">
            {t("combination.duration.label")}
          </span>
          <span className="tabular ml-auto text-sm font-semibold text-ink">
            {combination.durationValue} {unitLabel}
          </span>
        </div>

        {/* ── Bloco 3 — Visão financeira (3 colunas) ── */}
        <div className="mb-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-subtle">
            💰 {t("combination.financial.title")} — {combination.label} ·{" "}
            {combination.durationValue} {unitLabel}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Gastos */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-3 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {t("combination.financial.expenses")}
              </p>
              <p className="mb-3 text-[10px] text-ink-subtle">
                {t("combination.financial.expensesSub")}
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-subtle">
                    {t("combination.financial.rent")}
                  </span>
                  <span className="tabular text-ink">
                    {formatEuro(fin.totalRent)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-subtle">
                    + {t("combination.financial.honorarium")}
                  </span>
                  <span className="tabular text-ink">
                    {formatEuro(fin.totalHonorarium)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-subtle">
                    + {t("combination.financial.deposit")}
                  </span>
                  <span className="tabular text-ink">
                    {formatEuro(fin.totalDeposit)}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex justify-between border-t border-[var(--hairline)] pt-2 text-xs font-bold">
                <span className="text-ink-muted">
                  {t("combination.financial.total")}
                </span>
                <span className="tabular text-ink">
                  {formatEuro(fin.totalExpenses)}
                </span>
              </div>
            </div>

            {/* Créditos */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--green-soft,#052e16)] p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-green-400">
                {t("combination.financial.credits")}
              </p>
              <p className="mb-3 text-[10px] text-ink-subtle">
                {t("combination.financial.creditsSub")}
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-subtle">
                    {t("combination.financial.deposit")}
                  </span>
                  <span className="tabular text-green-400">
                    {formatEuro(fin.totalDeposit)}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex justify-between border-t border-[var(--hairline)] pt-2 text-xs font-bold">
                <span className="text-ink-muted">
                  {t("combination.financial.total")}
                </span>
                <span className="tabular text-green-400">
                  {formatEuro(fin.totalCredit)}
                </span>
              </div>
            </div>

            {/* Entrada inicial */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--yellow-soft,#422006)] p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-yellow-400">
                {t("combination.financial.initial")}
              </p>
              <p className="mb-3 text-[10px] text-ink-subtle">
                {t("combination.financial.initialSub")}
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-subtle">
                    {t("combination.financial.rent")} (1×)
                  </span>
                  <span className="tabular text-ink">
                    {formatEuro(firstMonthRent)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-subtle">
                    + {t("combination.financial.deposit")}
                  </span>
                  <span className="tabular text-ink">
                    {formatEuro(fin.totalDeposit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-subtle">
                    + {t("combination.financial.honorarium")}
                  </span>
                  <span className="tabular text-ink">
                    {formatEuro(fin.totalHonorarium)}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex justify-between border-t border-[var(--hairline)] pt-2 text-xs font-bold">
                <span className="text-ink-muted">
                  {t("combination.financial.total")}
                </span>
                <span className="tabular text-yellow-400">
                  {formatEuro(fin.initialOutflow)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Bloco 4 — Custo real líquido destacado ── */}
          <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--hairline-medium)] bg-surface-1 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="mb-0.5 text-[11px] text-ink-subtle">
                  📊 {t("combination.financial.net")}{" "}
                  <span className="text-ink-subtle">
                    ({t("combination.financial.netSub")})
                  </span>
                </p>
                <p className="tabular text-3xl font-bold tracking-tight text-orange-400">
                  {formatEuro(fin.netCost)}
                </p>
                <p className="mt-1 text-[10px] text-ink-subtle">
                  {t("combination.financial.afterDeposit")}
                </p>
              </div>

              <div className="flex flex-col gap-1 border-l border-[var(--hairline)] pl-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="tabular text-sm font-semibold text-ink">
                    {formatEuro(fin.netCostPerPerson)}
                  </span>
                  <span className="text-[11px] text-ink-subtle">
                    {t("combination.financial.perPerson")}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="tabular text-sm font-semibold text-ink">
                    {formatEuro(fin.netCostPerProperty)}
                  </span>
                  <span className="text-[11px] text-ink-subtle">
                    {t("combination.financial.perProperty")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bloco 5 — Nota (só quando existe) ── */}
        {combination.notes && (
          <div className="mb-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-subtle">
              {t("combination.note.label")}
            </p>
            <p className="whitespace-pre-wrap rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-3 px-3.5 py-2.5 text-sm text-ink-muted">
              {combination.notes}
            </p>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--hairline)] pt-4">
          <button
            onClick={onClose}
            className="btn-glass rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium"
          >
            {t("action.close")}
          </button>
          {/* Editar: reabre a composição no editor completo (reidratado). */}
          <button
            type="button"
            onClick={onEdit}
            className="btn-glass-accent flex items-center gap-1.5 rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium"
          >
            <Pencil size={14} strokeWidth={1.75} />
            {t("action.edit")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
