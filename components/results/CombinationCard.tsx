"use client";

import { useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFocusTrap } from "@/lib/useFocusTrap";
import {
  Layers,
  BedDouble,
  Check,
  AlertTriangle,
  X,
  ExternalLink,
  Car,
  Send,
  BookmarkCheck,
  Loader2,
  Pencil,
} from "lucide-react";
import { cn, formatEuro } from "@/lib/utils";
import { buildProposalText, whatsappUrl } from "@/lib/proposal";
import { saveResult } from "@/app/(app)/search/[id]/results/actions";
import { PLATFORM_META, type SearchResult } from "@/types";
import type { Combination } from "@/lib/combinations";
import {
  calculateFinancials,
  type FinancialItemInput,
} from "@/lib/combinations";
import { useI18n } from "@/lib/i18n";

// ─── Tipos locais ──────────────────────────────────────────────────────────

interface PropertyOverride {
  beds?: number;
  driveMinutes?: number;
  monthlyRent?: number;
  deposit?: number;
  honorarium?: number;
  finalPrice?: number | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function resolveItem(
  p: SearchResult,
  ov: PropertyOverride
): FinancialItemInput {
  return {
    beds: ov.beds ?? p.num_beds ?? 0,
    driveMinutes: ov.driveMinutes ?? p.drive_minutes ?? null,
    monthlyRent: ov.monthlyRent ?? p.total_price ?? 0,
    deposit: ov.deposit ?? p.deposit ?? 0,
    honorarium: ov.honorarium ?? p.honorarium ?? 0,
    finalPrice: ov.finalPrice ?? null,
  };
}

// ─── CombinationCard (resumido) ────────────────────────────────────────────

export function CombinationCard({
  combo,
  workersNeeded,
  searchId,
}: {
  combo: Combination;
  workersNeeded: number;
  searchId: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const items: FinancialItemInput[] = combo.properties.map((p) =>
    resolveItem(p, {})
  );
  const fin = calculateFinancials(
    items,
    { value: 1, unit: "months" },
    workersNeeded
  );

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Ver detalhes da ${combo.label}`}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="relative cursor-pointer overflow-hidden rounded-[var(--radius-lg)] border bg-surface-2 p-5 transition-all duration-200 hover:border-[var(--hairline-medium)] hover:-translate-y-0.5"
        style={{
          borderColor: combo.withinBudget
            ? "var(--green-border)"
            : "var(--hairline-medium)",
          boxShadow: combo.withinBudget ? "var(--glow-green)" : undefined,
        }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} strokeWidth={1.5} className="text-orange-400" />
            <span className="text-sm font-semibold text-ink">{combo.label}</span>
            <span className="rounded-[var(--radius-pill)] bg-surface-4 px-2 py-0.5 text-[10px] text-ink-subtle">
              {combo.properties.length} imóveis
            </span>
          </div>
          {combo.withinBudget ? (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Check size={13} /> No orçamento
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <AlertTriangle size={13} /> Acima
            </span>
          )}
        </div>

        {/* Imóveis da combinação */}
        <div className="space-y-2">
          {combo.properties.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-3 px-3 py-2"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="rounded-[var(--radius-sm)] border border-[var(--hairline-medium)] bg-surface-4 px-1.5 py-0.5 text-[10px] text-ink-muted">
                  {PLATFORM_META[p.platform].label}
                </span>
                <span className="truncate text-xs text-ink-muted">
                  {p.title ?? p.address}
                </span>
                {!p.furnished && (
                  <span className="shrink-0 text-[10px] text-yellow-400">
                    · mobilar
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-ink-subtle">
                  <BedDouble size={12} /> {p.num_beds}
                </span>
                <span className="tabular text-ink">
                  {formatEuro(p.total_price)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Totais com lógica financeira (1 mês, sem overrides) */}
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--hairline)] pt-4">
          <Total
            label="Custo líquido/mês"
            value={formatEuro(fin.netCost)}
            accent={combo.withinBudget ? "green" : "red"}
          />
          <Total
            label={`Camas (${workersNeeded} nec.)`}
            value={`${combo.totalBeds}${combo.spareBeds > 0 ? ` (+${combo.spareBeds})` : ""}`}
          />
          <Total
            label={`${t("combination.financial.perPerson")} · ${t("combination.financial.netLabel")}`}
            value={formatEuro(fin.netCostPerPerson)}
            accent={combo.withinBudget ? "green" : "red"}
          />
        </div>

        <p className="mt-3 text-center text-[10px] text-ink-subtle">
          Clica para detalhes e simulação de estadia
        </p>
      </div>

      <AnimatePresence>
        {open && (
          <CombinationModal
            combo={combo}
            workersNeeded={workersNeeded}
            searchId={searchId}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── CombinationModal ──────────────────────────────────────────────────────

function CombinationModal({
  combo,
  workersNeeded,
  searchId,
  onClose,
}: {
  combo: Combination;
  workersNeeded: number;
  searchId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true, onClose);

  const [duration, setDuration] = useState(1);
  const [unit, setUnit] = useState<"months" | "weeks" | "days">("months");
  const [note, setNote] = useState("");
  const [shareLabel, setShareLabel] = useState<"default" | "copied">("default");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [isPending, startTransition] = useTransition();

  // TASK 3.1 — overrides por imóvel + controle de edição ativa
  const [overrides, setOverrides] = useState<
    Record<string, PropertyOverride>
  >({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftOverride, setDraftOverride] = useState<PropertyOverride>({});

  function startEdit(p: SearchResult) {
    const ov = overrides[p.id] ?? {};
    setDraftOverride({
      beds: ov.beds ?? p.num_beds ?? 0,
      driveMinutes:
        ov.driveMinutes !== undefined ? ov.driveMinutes : (p.drive_minutes ?? undefined),
      monthlyRent: ov.monthlyRent ?? p.total_price ?? 0,
      deposit: ov.deposit ?? p.deposit ?? 0,
      honorarium: ov.honorarium ?? p.honorarium ?? 0,
      finalPrice: ov.finalPrice ?? null,
    });
    setEditingId(p.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftOverride({});
  }

  function saveEdit(pid: string) {
    setOverrides((prev) => ({ ...prev, [pid]: { ...draftOverride } }));
    setEditingId(null);
    setDraftOverride({});
  }

  function handleShare() {
    const text = buildProposalText(combo.properties, {});
    navigator.clipboard.writeText(text).catch(() => undefined);
    window.open(whatsappUrl(text), "_blank");
    setShareLabel("copied");
    setTimeout(() => setShareLabel("default"), 2000);
  }

  function handleSave() {
    setSaveError(null);
    startTransition(async () => {
      const results = await Promise.all(
        combo.properties.map((p) =>
          saveResult({ resultId: p.id, searchId })
        )
      );
      const firstError = results.find((r) => r.error);
      if (firstError?.error) {
        setSaveError(firstError.error);
        return;
      }
      setSavedOk(true);
      setTimeout(() => {
        onClose();
      }, 800);
    });
  }

  // TASK 3.2 — construir items resolvidos para calculateFinancials
  const resolvedItems: FinancialItemInput[] = combo.properties.map((p) =>
    resolveItem(p, overrides[p.id] ?? {})
  );
  const fin = calculateFinancials(
    resolvedItems,
    { value: duration, unit },
    workersNeeded
  );

  // Para o gráfico (SECÇÃO E), usa total_price base (sem override)
  const maxCost = Math.max(
    ...combo.properties.map((p) => p.total_price ?? 0),
    1
  );

  const unitLabel =
    unit === "months" ? "meses" : unit === "weeks" ? "semanas" : "dias";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="combination-modal-title"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Painel */}
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--hairline-medium)] bg-surface-2 p-6"
      >
        {/* SECÇÃO A — Header */}
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <Layers size={18} strokeWidth={1.5} className="text-orange-400" />
            <h3
              id="combination-modal-title"
              className="text-lg font-semibold text-ink"
            >
              {combo.label}
            </h3>
            <span className="rounded-[var(--radius-pill)] bg-surface-4 px-2 py-0.5 text-[11px] text-ink-muted">
              {combo.properties.length} imóveis
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar modal"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* SECÇÃO B — Lista detalhada com inputs editáveis (TASK 3.1) */}
        <div className="mb-6 space-y-3">
          {combo.properties.map((p) => {
            const ov = overrides[p.id] ?? {};
            const isEditing = editingId === p.id;

            return (
              <div
                key={p.id}
                className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-3 p-4"
              >
                {/* Cabeçalho do card */}
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-[var(--radius-sm)] border border-[var(--hairline-medium)] bg-surface-4 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                      {PLATFORM_META[p.platform].label}
                    </span>
                    {!p.furnished && (
                      <span className="rounded-[var(--radius-pill)] border border-[var(--yellow-border)] bg-[var(--yellow-soft)] px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                        Precisa Mobilar
                      </span>
                    )}
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(p)}
                      aria-label={`Editar ${p.title ?? p.address}`}
                      className="flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--hairline-medium)] bg-surface-4 px-2 py-1 text-[10px] text-ink-muted transition-colors hover:border-orange-500/40 hover:text-orange-400"
                    >
                      <Pencil size={10} strokeWidth={1.5} />
                      {t("combination.edit.edit")}
                    </button>
                  )}
                </div>

                <p className="text-sm font-medium text-ink">
                  {p.title ?? p.address}
                </p>

                {/* Modo visualização */}
                {!isEditing && (
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-subtle">
                    <span className="flex items-center gap-1">
                      <BedDouble size={13} />{" "}
                      {ov.beds ?? p.num_beds} camas
                    </span>
                    <span className="flex items-center gap-1">
                      <Car size={13} />{" "}
                      {(ov.driveMinutes ?? p.drive_minutes) != null
                        ? `${ov.driveMinutes ?? p.drive_minutes} min`
                        : "—"}
                    </span>
                    <span className="tabular text-ink-muted">
                      {formatEuro(
                        ov.finalPrice ?? ov.monthlyRent ?? p.total_price
                      )}
                      /mês
                      {ov.finalPrice != null && (
                        <span className="ml-1 text-orange-400">(negociado)</span>
                      )}
                    </span>
                    {p.external_url && (
                      <a
                        href={p.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-orange-400 transition-colors hover:text-orange-300"
                      >
                        <ExternalLink size={13} /> Ver anúncio
                      </a>
                    )}
                  </div>
                )}

                {/* Modo edição — grid 2×3 */}
                {isEditing && (
                  <div className="mt-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {/* Camas */}
                      <div>
                        <label
                          htmlFor={`beds-${p.id}`}
                          className="mb-1 block text-[11px] text-ink-subtle"
                        >
                          {t("combination.field.beds")}
                        </label>
                        <input
                          id={`beds-${p.id}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={draftOverride.beds ?? ""}
                          onChange={(e) =>
                            setDraftOverride((d) => ({
                              ...d,
                              beds:
                                e.target.value === ""
                                  ? undefined
                                  : Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
                        />
                      </div>

                      {/* Drive (min) */}
                      <div>
                        <label
                          htmlFor={`drive-${p.id}`}
                          className="mb-1 block text-[11px] text-ink-subtle"
                        >
                          {t("combination.field.drive")}
                        </label>
                        <input
                          id={`drive-${p.id}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={draftOverride.driveMinutes ?? ""}
                          onChange={(e) =>
                            setDraftOverride((d) => ({
                              ...d,
                              driveMinutes:
                                e.target.value === ""
                                  ? undefined
                                  : Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
                        />
                      </div>

                      {/* Mensalidade */}
                      <div>
                        <label
                          htmlFor={`rent-${p.id}`}
                          className="mb-1 block text-[11px] text-ink-subtle"
                        >
                          {t("combination.field.rent")}
                        </label>
                        <input
                          id={`rent-${p.id}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step={10}
                          value={draftOverride.monthlyRent ?? ""}
                          onChange={(e) =>
                            setDraftOverride((d) => ({
                              ...d,
                              monthlyRent:
                                e.target.value === ""
                                  ? undefined
                                  : Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
                        />
                      </div>

                      {/* Honorário */}
                      <div>
                        <label
                          htmlFor={`honorarium-${p.id}`}
                          className="mb-1 block text-[11px] text-ink-subtle"
                        >
                          {t("combination.field.honorarium")}{" "}
                          <span
                            title={t("tooltip.honorarium")}
                            className="cursor-help text-red-400"
                          >
                            ❌
                          </span>
                        </label>
                        <input
                          id={`honorarium-${p.id}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step={10}
                          value={draftOverride.honorarium ?? ""}
                          onChange={(e) =>
                            setDraftOverride((d) => ({
                              ...d,
                              honorarium:
                                e.target.value === ""
                                  ? undefined
                                  : Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
                        />
                      </div>

                      {/* Calção */}
                      <div>
                        <label
                          htmlFor={`deposit-${p.id}`}
                          className="mb-1 block text-[11px] text-ink-subtle"
                        >
                          {t("combination.field.deposit")}{" "}
                          <span
                            title={t("tooltip.deposit")}
                            className="cursor-help text-green-400"
                          >
                            ✅
                          </span>
                        </label>
                        <input
                          id={`deposit-${p.id}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step={10}
                          value={draftOverride.deposit ?? ""}
                          onChange={(e) =>
                            setDraftOverride((d) => ({
                              ...d,
                              deposit:
                                e.target.value === ""
                                  ? undefined
                                  : Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
                        />
                      </div>

                      {/* Preço final negociado */}
                      <div>
                        <label
                          htmlFor={`finalPrice-${p.id}`}
                          className="mb-1 block text-[11px] text-ink-subtle"
                        >
                          {t("combination.field.finalPrice")}{" "}
                          <span
                            title={t("tooltip.finalPrice")}
                            className="cursor-help text-orange-400"
                          >
                            ✏️
                          </span>
                        </label>
                        <input
                          id={`finalPrice-${p.id}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step={10}
                          placeholder="—"
                          value={
                            draftOverride.finalPrice != null
                              ? draftOverride.finalPrice
                              : ""
                          }
                          onChange={(e) =>
                            setDraftOverride((d) => ({
                              ...d,
                              finalPrice:
                                e.target.value === ""
                                  ? null
                                  : Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Rodapé do card em edição */}
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        onClick={cancelEdit}
                        className="rounded-[var(--radius-md)] border border-[var(--hairline-medium)] px-3 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
                      >
                        {t("combination.edit.cancel")}
                      </button>
                      <button
                        onClick={() => saveEdit(p.id)}
                        className="rounded-[var(--radius-md)] border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/20"
                      >
                        {t("combination.edit.save")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* SECÇÃO C — Seletor de duração */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-subtle">
            Duração da estadia
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={52}
              value={duration}
              onChange={(e) =>
                setDuration(
                  Math.min(52, Math.max(1, Number(e.target.value) || 1))
                )
              }
              className="tabular w-20 rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3 py-2 text-sm text-ink focus:border-[var(--orange-border)] focus:outline-none"
            />
            <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-1 p-1">
              {(
                [
                  ["months", "Meses"],
                  ["weeks", "Semanas"],
                  ["days", "Dias"],
                ] as const
              ).map(([u, label]) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={cn(
                    "cursor-pointer rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-colors",
                    unit === u
                      ? "bg-surface-3 text-ink"
                      : "text-ink-subtle hover:text-ink-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SECÇÃO D — Visão financeira (TASK 3.2 — substitui bloco anterior) */}
        <div className="mb-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-subtle">
            💰 {t("combination.financial.title")} — {combo.label} · {duration}{" "}
            {unitLabel}
          </p>

          {/* 3 colunas: Gastos / Créditos / Ingresso */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Gastos */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-3 p-3">
              <p className="mb-2 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
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
              <div className="mt-3 border-t border-[var(--hairline)] pt-2 flex justify-between text-xs font-bold">
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
              <p className="mb-2 text-[11px] font-semibold text-green-400 uppercase tracking-wider">
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
              <div className="mt-3 border-t border-[var(--hairline)] pt-2 flex justify-between text-xs font-bold">
                <span className="text-ink-muted">
                  {t("combination.financial.total")}
                </span>
                <span className="tabular text-green-400">
                  {formatEuro(fin.totalCredit)}
                </span>
              </div>
            </div>

            {/* Ingresso */}
            <div className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--yellow-soft,#422006)] p-3">
              <p className="mb-2 text-[11px] font-semibold text-yellow-400 uppercase tracking-wider">
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
                    {formatEuro(
                      resolvedItems.reduce(
                        (s, item) =>
                          s + (item.finalPrice ?? item.monthlyRent),
                        0
                      )
                    )}
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
              <div className="mt-3 border-t border-[var(--hairline)] pt-2 flex justify-between text-xs font-bold">
                <span className="text-ink-muted">
                  {t("combination.financial.total")}
                </span>
                <span className="tabular text-yellow-400">
                  {formatEuro(fin.initialOutflow)}
                </span>
              </div>
            </div>
          </div>

          {/* Linha de resumo — custo real líquido */}
          <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--hairline-medium)] bg-surface-1 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="mb-0.5 text-[11px] text-ink-subtle">
                  📊 {t("combination.financial.net")}{" "}
                  <span className="text-ink-subtle">
                    ({t("combination.financial.netSub")})
                  </span>
                </p>
                <p
                  className={cn(
                    "tabular text-3xl font-bold tracking-tight",
                    combo.withinBudget ? "text-green-400" : "text-orange-400"
                  )}
                >
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

        {/* SECÇÃO E — Gráfico comparativo (mantido) */}
        <div className="mb-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-subtle">
            Distribuição de custo por imóvel
          </p>
          <div className="space-y-2.5">
            {combo.properties.map((p) => {
              const pct = ((p.total_price ?? 0) / maxCost) * 100;
              return (
                <div key={p.id}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="truncate text-ink-muted">
                      {p.title ?? p.address}
                    </span>
                    <span className="tabular shrink-0 pl-2 text-ink-subtle">
                      {formatEuro(p.total_price)}/mês
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-[var(--radius-pill)] bg-surface-3">
                    <div
                      className="h-full rounded-[var(--radius-pill)]"
                      style={{
                        width: `${Math.max(pct, 4)}%`,
                        background:
                          "linear-gradient(90deg, var(--color-orange-500), var(--color-green-500))",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECÇÃO F — Nota */}
        <div className="mb-6">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-subtle">
            Nota
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notas sobre esta combinação..."
            rows={3}
            className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-[var(--orange-border)] focus:outline-none"
          />
        </div>

        {/* SECÇÃO G — Acções do rodapé */}
        <div className="flex flex-col gap-3">
          {saveError && (
            <p className="rounded-[var(--radius-md)] border border-[var(--red-border)] bg-[var(--red-soft)] px-3 py-2 text-xs text-red-400">
              {saveError}
            </p>
          )}
          <div className="flex items-center justify-end gap-2 border-t border-[var(--hairline)] pt-4">
            <button
              onClick={handleShare}
              className={cn(
                "flex items-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-2 text-xs font-medium transition-all",
                shareLabel === "copied"
                  ? "border-[var(--green-border)] bg-[var(--green-soft)] text-green-400"
                  : "border-[var(--hairline-medium)] bg-surface-3 text-ink-muted hover:border-[var(--orange-border)] hover:text-orange-400"
              )}
            >
              {shareLabel === "copied" ? (
                <>
                  <Check size={13} strokeWidth={1.5} /> Copiado
                </>
              ) : (
                <>
                  <Send size={13} strokeWidth={1.5} /> Partilhar
                </>
              )}
            </button>

            <button
              onClick={handleSave}
              disabled={isPending || savedOk}
              className={cn(
                "flex items-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-2 text-xs font-medium transition-all disabled:cursor-not-allowed",
                savedOk
                  ? "border-[var(--green-border)] bg-[var(--green-soft)] text-green-400"
                  : "border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 disabled:opacity-60"
              )}
            >
              {isPending ? (
                <>
                  <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> A guardar...
                </>
              ) : savedOk ? (
                <>
                  <BookmarkCheck size={13} strokeWidth={1.5} /> Guardado
                </>
              ) : (
                <>
                  <BookmarkCheck size={13} strokeWidth={1.5} /> Guardar combinação
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Primitivos de display ─────────────────────────────────────────────────

function Total({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "red";
}) {
  return (
    <div>
      <div
        className={cn(
          "tabular text-sm font-bold",
          accent === "green"
            ? "text-green-400"
            : accent === "red"
              ? "text-red-400"
              : "text-ink"
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-ink-subtle">{label}</div>
    </div>
  );
}
