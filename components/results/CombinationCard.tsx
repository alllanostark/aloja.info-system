"use client";

import { useCallback, useRef, useState, useTransition } from "react";
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
  ArrowLeftRight,
  Trash2,
  Plus,
} from "lucide-react";
import { cn, formatEuro } from "@/lib/utils";
import { buildProposalText, whatsappUrl } from "@/lib/proposal";
import { saveResult } from "@/app/(app)/search/[id]/results/actions";
import { saveCombination } from "@/app/(app)/search/[id]/results/combination-actions";
import type { SaveCombinationItemInput } from "@/app/(app)/search/[id]/results/combination-actions";
import { PLATFORM_META, type SearchResult } from "@/types";
import type { Combination } from "@/lib/combinations";
import {
  calculateFinancials,
  type FinancialItemInput,
  type EditableItem,
} from "@/lib/combinations";
import { useI18n } from "@/lib/i18n";
import { PropertyPicker } from "./PropertyPicker";

// ─── Mapper: SearchResult → EditableItem ──────────────────────────────────────

function searchResultToItem(p: SearchResult): EditableItem {
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

function itemToFinancial(item: EditableItem): FinancialItemInput {
  return {
    beds: item.beds,
    driveMinutes: item.driveMinutes,
    monthlyRent: item.monthlyRent,
    deposit: item.deposit,
    honorarium: item.honorarium,
    finalPrice: item.finalPrice,
  };
}

// ─── CombinationCard (resumo) ─────────────────────────────────────────────────

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

  const items: FinancialItemInput[] = combo.properties.map((p) => ({
    beds: p.num_beds ?? 0,
    driveMinutes: p.drive_minutes,
    monthlyRent: p.total_price ?? 0,
    deposit: p.deposit ?? 0,
    honorarium: p.honorarium ?? 0,
    finalPrice: null,
  }));
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
              {combo.properties.length} {t("combination.card.properties")}
            </span>
          </div>
          {combo.withinBudget ? (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Check size={13} /> {t("combination.card.withinBudget")}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <AlertTriangle size={13} /> {t("combination.card.above")}
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
                    · {t("combination.card.furnish")}
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

        {/* Totais */}
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--hairline)] pt-4">
          <Total
            label={t("combination.card.costPerMonth")}
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
          {t("combination.card.hint")}
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

// ─── CombinationModal ─────────────────────────────────────────────────────────

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

  // ─── Estado principal: lista mutável de itens ─────────────────────────────
  const [items, setItems] = useState<EditableItem[]>(() =>
    combo.properties.map(searchResultToItem)
  );

  // ─── Título editável (Task 4.3) ───────────────────────────────────────────
  const [label, setLabel] = useState(combo.label);
  const [editingLabel, setEditingLabel] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);

  // ─── Edição inline de item (Task 3.1 preservado) ─────────────────────────
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftItem, setDraftItem] = useState<Partial<EditableItem>>({});

  // ─── Controle do PropertyPicker (Task 4.1/4.2) ───────────────────────────
  type PickerMode = { type: "swap"; index: number } | { type: "add" } | null;
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [confirmRemoveKey, setConfirmRemoveKey] = useState<string | null>(null);

  // ─── Duração, nota, share/save ────────────────────────────────────────────
  const [duration, setDuration] = useState(1);
  const [unit, setUnit] = useState<"months" | "weeks" | "days">("months");
  const [note, setNote] = useState("");
  const [shareLabel, setShareLabel] = useState<"default" | "copied">("default");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [isPending, startTransition] = useTransition();

  // ─── Persistência de composição (Task 4.4) ────────────────────────────────
  const [savedOverrideId, setSavedOverrideId] = useState<string | null>(null);
  const [savingCombo, startComboTransition] = useTransition();
  const [comboSavedOk, setComboSavedOk] = useState(false);

  // ─── Edição inline: iniciar ───────────────────────────────────────────────
  function startEdit(item: EditableItem) {
    setDraftItem({
      beds: item.beds,
      driveMinutes: item.driveMinutes ?? undefined,
      monthlyRent: item.monthlyRent,
      deposit: item.deposit,
      honorarium: item.honorarium,
      finalPrice: item.finalPrice,
    });
    setEditingKey(item.key);
  }

  function cancelEdit() {
    setEditingKey(null);
    setDraftItem({});
  }

  function saveEdit(key: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.key === key
          ? {
              ...it,
              beds: draftItem.beds ?? it.beds,
              driveMinutes:
                draftItem.driveMinutes !== undefined
                  ? draftItem.driveMinutes
                  : it.driveMinutes,
              monthlyRent: draftItem.monthlyRent ?? it.monthlyRent,
              deposit: draftItem.deposit ?? it.deposit,
              honorarium: draftItem.honorarium ?? it.honorarium,
              finalPrice:
                draftItem.finalPrice !== undefined
                  ? draftItem.finalPrice
                  : it.finalPrice,
            }
          : it
      )
    );
    setEditingKey(null);
    setDraftItem({});
  }

  // ─── Swap / Add via picker ────────────────────────────────────────────────
  function handlePickerSelect(picked: EditableItem) {
    if (!pickerMode) return;
    if (pickerMode.type === "swap") {
      const idx = pickerMode.index;
      setItems((prev) => prev.map((it, i) => (i === idx ? picked : it)));
    } else {
      setItems((prev) => [...prev, picked]);
    }
  }

  // ─── Remover item ────────────────────────────────────────────────────────
  function handleRemove(key: string) {
    if (items.length <= 1) return;
    if (confirmRemoveKey === key) {
      setItems((prev) => prev.filter((it) => it.key !== key));
      setConfirmRemoveKey(null);
      if (editingKey === key) cancelEdit();
    } else {
      setConfirmRemoveKey(key);
    }
  }

  // ─── Share / Save ─────────────────────────────────────────────────────────
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
      const saveable = items.filter(
        (it) =>
          (it.sourceType === "search" || it.sourceType === "discarded") &&
          it.sourceId != null
      );
      const results = await Promise.all(
        saveable.map((it) =>
          saveResult({ resultId: it.sourceId!, searchId })
        )
      );
      const firstError = results.find((r) => r.error);
      if (firstError?.error) {
        setSaveError(firstError.error);
        return;
      }
      setSavedOk(true);
      setTimeout(() => onClose(), 800);
    });
  }

  // ─── Salvar composição (Task 4.4) ─────────────────────────────────────────
  function handleSaveCombo() {
    setSaveError(null);
    startComboTransition(async () => {
      const mappedItems: SaveCombinationItemInput[] = items.map((it, index) => ({
        source_type: it.sourceType,
        source_id: it.sourceId,
        override_title: it.title,
        override_beds: it.beds,
        override_drive_minutes: it.driveMinutes,
        override_monthly_rent: it.monthlyRent,
        override_deposit: it.deposit,
        override_honorarium: it.honorarium,
        override_final_price: it.finalPrice,
        position: index,
      }));
      const result = await saveCombination({
        overrideId: savedOverrideId,
        searchId,
        label,
        durationValue: duration,
        durationUnit: unit,
        notes: note || null,
        items: mappedItems,
      });
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      setSavedOverrideId(result.overrideId ?? null);
      setComboSavedOk(true);
      setTimeout(() => setComboSavedOk(false), 2000);
    });
  }

  // ─── Financeiros — recalculados a partir de items ─────────────────────────
  const resolvedItems = items.map(itemToFinancial);
  const fin = calculateFinancials(
    resolvedItems,
    { value: duration, unit },
    workersNeeded
  );

  const maxCost = Math.max(...items.map((it) => it.monthlyRent), 1);
  const unitLabel =
    unit === "months"
      ? t("combination.duration.months")
      : unit === "weeks"
        ? t("combination.duration.weeks")
        : t("combination.duration.days");

  const excludeKeys = items.map((it) => it.key);

  const handleCloseLabel = useCallback(() => {
    setEditingLabel(false);
  }, []);

  return (
    <>
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
          {/* SECÇÃO A — Header com título editável (Task 4.3) */}
          <div className="mb-5 flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <Layers size={18} strokeWidth={1.5} className="text-orange-400" />
              {editingLabel ? (
                <input
                  ref={labelInputRef}
                  id="combination-modal-title"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onBlur={handleCloseLabel}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape")
                      handleCloseLabel();
                  }}
                  autoFocus
                  className="rounded-[var(--radius-sm)] border border-orange-500/60 bg-surface-3 px-2 py-0.5 text-lg font-semibold text-ink focus:outline-none"
                />
              ) : (
                <h3
                  id="combination-modal-title"
                  className="text-lg font-semibold text-ink"
                >
                  {label}
                </h3>
              )}
              {!editingLabel && (
                <button
                  onClick={() => setEditingLabel(true)}
                  aria-label={t("combination.rename")}
                  className="flex items-center justify-center rounded-[var(--radius-sm)] p-1 text-ink-subtle transition-colors hover:text-orange-400"
                >
                  <Pencil size={13} strokeWidth={1.5} />
                </button>
              )}
              <span className="rounded-[var(--radius-pill)] bg-surface-4 px-2 py-0.5 text-[11px] text-ink-muted">
                {items.length} {t("combination.card.properties")}
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label={t("action.close")}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>

          {/* SECÇÃO B — Lista detalhada com edição inline + ações (Task 4.1) */}
          <div className="mb-4 space-y-3">
            {items.map((item, index) => {
              const isEditing = editingKey === item.key;
              const isConfirmingRemove = confirmRemoveKey === item.key;

              return (
                <div
                  key={item.key}
                  className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-3 p-4"
                >
                  {/* Cabeçalho do card */}
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Badge de plataforma ou fonte */}
                      <span className="rounded-[var(--radius-sm)] border border-[var(--hairline-medium)] bg-surface-4 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                        {item.platform != null
                          ? PLATFORM_META[item.platform].label
                          : item.sourceType === "active"
                            ? t("combination.picker.sources.active")
                            : t("combination.picker.sources.external")}
                      </span>
                      {!item.furnished && (
                        <span className="rounded-[var(--radius-pill)] border border-[var(--yellow-border)] bg-[var(--yellow-soft)] px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                          {t("combination.furnish")}
                        </span>
                      )}
                    </div>

                    {/* Botões de ação: Editar / Trocar / Remover */}
                    {!isEditing && (
                      <div className="flex shrink-0 items-center gap-1">
                        {/* Editar */}
                        <button
                          onClick={() => startEdit(item)}
                          aria-label={`Editar ${item.title ?? item.address}`}
                          className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--hairline-medium)] bg-surface-4 px-2 py-1 text-[10px] text-ink-muted transition-colors hover:border-orange-500/40 hover:text-orange-400"
                        >
                          <Pencil size={10} strokeWidth={1.5} />
                          {t("combination.edit.edit")}
                        </button>

                        {/* Trocar */}
                        <button
                          onClick={() => {
                            setConfirmRemoveKey(null);
                            setPickerMode({ type: "swap", index });
                          }}
                          aria-label={t("combination.edit.swap")}
                          className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline-medium)] bg-surface-4 text-ink-muted transition-colors hover:border-orange-500/40 hover:text-orange-400"
                        >
                          <ArrowLeftRight size={11} strokeWidth={1.5} />
                        </button>

                        {/* Remover */}
                        {isConfirmingRemove ? (
                          <button
                            onClick={() => handleRemove(item.key)}
                            aria-label={t("combination.edit.removeConfirm")}
                            className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
                          >
                            <Trash2 size={10} strokeWidth={1.5} />
                            {t("combination.edit.removeConfirm")}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (items.length <= 1) return;
                              setConfirmRemoveKey(item.key);
                            }}
                            aria-label={t("combination.edit.remove")}
                            disabled={items.length <= 1}
                            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline-medium)] bg-surface-4 text-ink-muted transition-colors hover:border-red-500/40 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <X size={11} strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-sm font-medium text-ink">
                    {item.title ?? item.address}
                  </p>

                  {/* Modo visualização */}
                  {!isEditing && (
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-subtle">
                      <span className="flex items-center gap-1">
                        <BedDouble size={13} /> {item.beds} camas
                      </span>
                      <span className="flex items-center gap-1">
                        <Car size={13} />{" "}
                        {item.driveMinutes != null
                          ? `${item.driveMinutes} min`
                          : "—"}
                      </span>
                      <span className="tabular text-ink-muted">
                        {formatEuro(item.finalPrice ?? item.monthlyRent)}{t("combination.card.perMonth")}
                        {item.finalPrice != null && (
                          <span className="ml-1 text-orange-400">({t("combination.card.negotiated")})</span>
                        )}
                      </span>
                      {item.externalUrl && (
                        <a
                          href={item.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto flex items-center gap-1 text-orange-400 transition-colors hover:text-orange-300"
                        >
                          <ExternalLink size={13} /> {t("action.viewAd")}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Modo edição — grid 2×3 */}
                  {isEditing && (
                    <div className="mt-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {/* Camas */}
                        <div>
                          <label
                            htmlFor={`beds-${item.key}`}
                            className="mb-1 block text-[11px] text-ink-subtle"
                          >
                            {t("combination.field.beds")}
                          </label>
                          <input
                            id={`beds-${item.key}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            value={draftItem.beds ?? ""}
                            onChange={(e) =>
                              setDraftItem((d) => ({
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
                            htmlFor={`drive-${item.key}`}
                            className="mb-1 block text-[11px] text-ink-subtle"
                          >
                            {t("combination.field.drive")}
                          </label>
                          <input
                            id={`drive-${item.key}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            value={draftItem.driveMinutes ?? ""}
                            onChange={(e) =>
                              setDraftItem((d) => ({
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
                            htmlFor={`rent-${item.key}`}
                            className="mb-1 block text-[11px] text-ink-subtle"
                          >
                            {t("combination.field.rent")}
                          </label>
                          <input
                            id={`rent-${item.key}`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={10}
                            value={draftItem.monthlyRent ?? ""}
                            onChange={(e) =>
                              setDraftItem((d) => ({
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
                            htmlFor={`honorarium-${item.key}`}
                            className="mb-1 block text-[11px] text-ink-subtle"
                            title={t("tooltip.honorarium")}
                          >
                            {t("combination.field.honorarium")}{" "}
                            <span
                              aria-hidden="true"
                              className="cursor-help text-red-400"
                            >
                              ❌
                            </span>
                          </label>
                          <input
                            id={`honorarium-${item.key}`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.01}
                            value={draftItem.honorarium ?? ""}
                            onChange={(e) =>
                              setDraftItem((d) => ({
                                ...d,
                                honorarium:
                                  e.target.value === ""
                                    ? undefined
                                    : Math.max(0, Number(e.target.value)),
                              }))
                            }
                            className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
                          />
                          <span className="mt-0.5 block text-[11px] text-ink-subtle">
                            ❌ {t("tooltip.honorarium")}
                          </span>
                        </div>

                        {/* Calção */}
                        <div>
                          <label
                            htmlFor={`deposit-${item.key}`}
                            className="mb-1 block text-[11px] text-ink-subtle"
                            title={t("tooltip.deposit")}
                          >
                            {t("combination.field.deposit")}{" "}
                            <span
                              aria-hidden="true"
                              className="cursor-help text-green-400"
                            >
                              ✅
                            </span>
                          </label>
                          <input
                            id={`deposit-${item.key}`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.01}
                            value={draftItem.deposit ?? ""}
                            onChange={(e) =>
                              setDraftItem((d) => ({
                                ...d,
                                deposit:
                                  e.target.value === ""
                                    ? undefined
                                    : Math.max(0, Number(e.target.value)),
                              }))
                            }
                            className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
                          />
                          <span className="mt-0.5 block text-[11px] text-ink-subtle">
                            ✅ {t("tooltip.deposit")}
                          </span>
                        </div>

                        {/* Preço final negociado */}
                        <div>
                          <label
                            htmlFor={`finalPrice-${item.key}`}
                            className="mb-1 block text-[11px] text-ink-subtle"
                            title={t("tooltip.finalPrice")}
                          >
                            {t("combination.field.finalPrice")}{" "}
                            <span
                              aria-hidden="true"
                              className="cursor-help text-orange-400"
                            >
                              ✏️
                            </span>
                          </label>
                          <input
                            id={`finalPrice-${item.key}`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.01}
                            placeholder="—"
                            value={
                              draftItem.finalPrice != null
                                ? draftItem.finalPrice
                                : ""
                            }
                            onChange={(e) =>
                              setDraftItem((d) => ({
                                ...d,
                                finalPrice:
                                  e.target.value === ""
                                    ? null
                                    : Math.max(0, Number(e.target.value)),
                              }))
                            }
                            className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
                          />
                          <span className="mt-0.5 block text-[11px] text-ink-subtle">
                            ✏️ {t("tooltip.finalPrice")}
                          </span>
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
                          onClick={() => saveEdit(item.key)}
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

          {/* Botão Adicionar imóvel */}
          <div className="mb-6">
            <button
              onClick={() => {
                setConfirmRemoveKey(null);
                setPickerMode({ type: "add" });
              }}
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] py-3 text-xs font-medium text-ink-subtle transition-colors hover:border-orange-500/50 hover:text-orange-400"
            >
              <Plus size={14} strokeWidth={1.5} />
              {t("combination.edit.add")}
            </button>
          </div>

          {/* SECÇÃO C — Seletor de duração */}
          <div className="mb-5">
            <label htmlFor="combo-duration" className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-subtle">
              {t("combination.duration.label")}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="combo-duration"
                type="number"
                inputMode="numeric"
                min={1}
                max={52}
                step={1}
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
                    ["months", t("combination.duration.months")],
                    ["weeks", t("combination.duration.weeks")],
                    ["days", t("combination.duration.days")],
                  ] as const
                ).map(([u, lbl]) => (
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
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECÇÃO D — Visão financeira (Fase 3 preservada, agora sobre items[]) */}
          <div className="mb-6">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-subtle">
              💰 {t("combination.financial.title")} — {label} · {duration}{" "}
              {unitLabel}
            </p>

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
                          (s, it) => s + (it.finalPrice ?? it.monthlyRent),
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

          {/* SECÇÃO E — Gráfico comparativo (sobre items[]) */}
          <div className="mb-6">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-ink-subtle">
              {t("combination.card.costDistribution")}
            </p>
            <div className="space-y-2.5">
              {items.map((item) => {
                const rent = item.finalPrice ?? item.monthlyRent;
                const pct = (rent / maxCost) * 100;
                return (
                  <div key={item.key}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="truncate text-ink-muted">
                        {item.title ?? item.address}
                      </span>
                      <span className="tabular shrink-0 pl-2 text-ink-subtle">
                        {formatEuro(rent)}{t("combination.card.perMonth")}
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
            <label htmlFor="combo-note" className="mb-2 block text-xs font-medium uppercase tracking-wider text-ink-subtle">
              {t("combination.note.label")}
            </label>
            <textarea
              id="combo-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("combination.note.placeholder")}
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
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--hairline)] pt-4">
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
                    <Check size={13} strokeWidth={1.5} /> {t("combination.action.copied")}
                  </>
                ) : (
                  <>
                    <Send size={13} strokeWidth={1.5} /> {t("combination.action.share")}
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
                    <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> {t("combination.action.saving")}
                  </>
                ) : savedOk ? (
                  <>
                    <BookmarkCheck size={13} strokeWidth={1.5} /> {t("combination.action.saved")}
                  </>
                ) : (
                  <>
                    <BookmarkCheck size={13} strokeWidth={1.5} /> {t("combination.action.saveResult")}
                  </>
                )}
              </button>

              <button
                onClick={handleSaveCombo}
                disabled={savingCombo}
                className={cn(
                  "flex items-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-2 text-xs font-medium transition-all disabled:cursor-not-allowed",
                  comboSavedOk
                    ? "border-[var(--green-border)] bg-[var(--green-soft)] text-green-400"
                    : "border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-60"
                )}
              >
                {savingCombo ? (
                  <>
                    <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> A salvar...
                  </>
                ) : comboSavedOk ? (
                  <>
                    <Check size={13} strokeWidth={1.5} /> {t("combination.saved")}
                  </>
                ) : (
                  <>
                    💾 {savedOverrideId ? t("combination.update") : t("combination.saveAs")}
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* PropertyPicker — z-[60], sobre o modal */}
      <AnimatePresence>
        {pickerMode && (
          <PropertyPicker
            searchId={searchId}
            mode={pickerMode.type}
            excludeKeys={excludeKeys}
            onSelect={handlePickerSelect}
            onClose={() => setPickerMode(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Primitivos de display ────────────────────────────────────────────────────

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
