"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { X, Loader2, Building2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { addAccommodation } from "@/app/(app)/accommodations/actions";
import { useFocusTrap } from "@/lib/useFocusTrap";

type Mode = "searched" | "external";

interface AddAccommodationFormProps {
  onClose: () => void;
  initialMode?: Mode;
  contacts?: { id: string; name: string }[];
}

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-orange-500 focus:outline-none transition-colors";

const labelClass = "mb-1.5 block text-xs font-medium text-ink-muted";

export function AddAccommodationForm({
  onClose,
  initialMode = "searched",
  contacts = [],
}: AddAccommodationFormProps) {
  const { t } = useI18n();
  const formRef = useRef<HTMLFormElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [showNewContact, setShowNewContact] = useState(false);

  const handleClose = useCallback(() => onClose(), [onClose]);
  useFocusTrap(panelRef, true, handleClose);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const result = await addAccommodation(formData);
        if (result.error) {
          setError(result.error);
        } else {
          onClose();
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("state.saveFailed")
        );
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-accommodation-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-canvas/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Painel */}
      <div
        ref={panelRef}
        className={cn(
          "relative z-10 w-full max-w-2xl rounded-[var(--radius-xl)] border border-[var(--hairline-medium)]",
          "bg-surface-2 shadow-[var(--shadow-xl)] overflow-hidden"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--orange-soft)]">
              <Building2 size={16} strokeWidth={1.5} className="text-orange-400" />
            </div>
            <h2 id="add-accommodation-title" className="text-base font-semibold text-ink">
              {t("accommodations.form.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("action.close")}
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-ink-subtle transition-colors hover:bg-surface-4 hover:text-ink cursor-pointer"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Toggle de modo */}
        <div className="border-b border-[var(--hairline)] px-6 py-3">
          <div className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-2 p-1 w-fit">
            {(["searched", "external"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium",
                  "transition-all duration-150",
                  mode === m
                    ? "bg-surface-4 text-ink shadow-[var(--shadow-xs)]"
                    : "text-ink-muted hover:text-ink"
                )}
              >
                {m === "searched" ? t("accommodations.form.mode.searched") : t("accommodations.form.mode.external")}
              </button>
            ))}
          </div>
        </div>

        {/* Formulário */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="max-h-[85vh] overflow-y-auto px-6 py-5"
        >
          {/* Hidden: status */}
          <input
            type="hidden"
            name="status"
            value={mode === "external" ? "external" : "active"}
          />

          <div className="space-y-4">
            {/* Secção exclusiva de externos: contacto vinculado */}
            {mode === "external" && (
              <div className="rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-3 px-4 py-4 space-y-3">
                {!showNewContact ? (
                  <div>
                    <label htmlFor="aaf-contact-id" className={labelClass}>
                      {t("accommodations.form.contact")}
                    </label>
                    <select
                      id="aaf-contact-id"
                      name="contact_id"
                      className={inputClass}
                    >
                      <option value="">{t("accommodations.form.contactNone")}</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewContact(true)}
                      className="mt-2 flex items-center gap-1 text-xs text-orange-400 hover:underline cursor-pointer"
                    >
                      <Plus size={12} strokeWidth={2} />
                      {t("accommodations.form.createContact")}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-ink-muted">{t("accommodations.form.createContact")}</p>
                      <button
                        type="button"
                        onClick={() => setShowNewContact(false)}
                        className="text-xs text-ink-subtle hover:text-ink cursor-pointer"
                      >
                        {t("action.cancel")}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="aaf-new-contact-name" className={labelClass}>
                          {t("accommodations.form.newContactName")} <span className="text-red-400">*</span>
                        </label>
                        <input
                          id="aaf-new-contact-name"
                          name="new_contact_name"
                          required={showNewContact}
                          placeholder="Josep Sala"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label htmlFor="aaf-new-contact-phone" className={labelClass}>
                          {t("accommodations.form.newContactPhone")}
                        </label>
                        <input
                          id="aaf-new-contact-phone"
                          name="new_contact_phone"
                          type="tel"
                          placeholder="+34 600 000 000"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Endereço */}
            <div>
              <label htmlFor="aaf-address" className={labelClass}>
                {t("accommodations.field.address")} <span className="text-red-400">*</span>
              </label>
              <input
                id="aaf-address"
                name="address"
                required
                placeholder="Rua Exemple, 12, 3º"
                className={inputClass}
              />
            </div>

            {/* Cidade */}
            <div>
              <label htmlFor="aaf-city" className={labelClass}>
                {t("accommodations.field.city")}
              </label>
              <input
                id="aaf-city"
                name="city"
                placeholder="Barcelona"
                className={inputClass}
              />
            </div>

            {/* Nº camas + Renda */}
            <div className={cn("grid grid-cols-1 gap-3", mode !== "external" ? "sm:grid-cols-2" : "")}>
              {mode !== "external" && (
                <div>
                  <label htmlFor="aaf-total-beds" className={labelClass}>
                    {t("accommodations.field.beds")} <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="aaf-total-beds"
                    name="total_beds"
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="4"
                    inputMode="numeric"
                    className={cn(inputClass, "tabular")}
                  />
                </div>
              )}
              <div>
                <label htmlFor="aaf-monthly-rent" className={labelClass}>
                  {t("accommodations.field.rent")}
                </label>
                <input
                  id="aaf-monthly-rent"
                  name="monthly_rent"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="1200"
                  inputMode="decimal"
                  className={cn(inputClass, "tabular")}
                />
              </div>
            </div>

            {/* Honorário + Calção */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="aaf-honorarium" className={labelClass} title={t("tooltip.honorarium")}>
                  {t("accommodations.field.honorarium")}{" "}
                  <span aria-hidden="true" className="cursor-help text-red-400">❌</span>
                </label>
                <input
                  id="aaf-honorarium"
                  name="honorarium"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  inputMode="decimal"
                  className={cn(inputClass, "tabular")}
                />
                <span className="mt-0.5 block text-[11px] text-ink-subtle">
                  ❌ {t("tooltip.honorarium")}
                </span>
              </div>
              <div>
                <label htmlFor="aaf-deposit" className={labelClass} title={t("tooltip.deposit")}>
                  {t("accommodations.field.deposit")}{" "}
                  <span aria-hidden="true" className="cursor-help text-green-400">✅</span>
                </label>
                <input
                  id="aaf-deposit"
                  name="deposit"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  inputMode="decimal"
                  className={cn(inputClass, "tabular")}
                />
                <span className="mt-0.5 block text-[11px] text-ink-subtle">
                  ✅ {t("tooltip.deposit")}
                </span>
              </div>
            </div>

            {/* Obra */}
            <div>
              <label htmlFor="aaf-obra-name" className={labelClass}>
                {t("accommodations.field.obra")}
              </label>
              <input
                id="aaf-obra-name"
                name="obra_name"
                placeholder="Obra Hospitalet"
                className={inputClass}
              />
            </div>

            {/* Datas de contrato */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="aaf-contract-start" className={labelClass}>
                  {t("accommodations.field.contractStart")}
                </label>
                <input
                  id="aaf-contract-start"
                  name="contract_start"
                  type="date"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="aaf-contract-end" className={labelClass}>
                  {t("accommodations.field.contractEnd")}
                </label>
                <input
                  id="aaf-contract-end"
                  name="contract_end"
                  type="date"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Proprietário + telefone */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="aaf-owner-name" className={labelClass}>
                  {t("accommodations.field.owner")}
                </label>
                <input
                  id="aaf-owner-name"
                  name="owner_name"
                  placeholder="Josep Sala"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="aaf-owner-phone" className={labelClass}>
                  {t("accommodations.field.phone")}
                </label>
                <input
                  id="aaf-owner-phone"
                  name="owner_phone"
                  type="tel"
                  placeholder="+34 600 000 000"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Mobilado */}
            <div>
              <fieldset className="border-none p-0 m-0">
                <legend className="mb-1.5 text-xs font-medium text-ink-muted">
                  {t("accommodations.field.furnished")}
                </legend>
                <div className="flex gap-3">
                  {[
                    { value: "true", label: t("accommodations.field.furnished.yes"), id: "aaf-furnished-yes" },
                    { value: "false", label: t("accommodations.field.furnished.no"), id: "aaf-furnished-no" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      htmlFor={opt.id}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        id={opt.id}
                        type="radio"
                        name="furnished"
                        value={opt.value}
                        defaultChecked={opt.value === "true"}
                        className="accent-orange-500"
                      />
                      <span className="text-sm text-ink-muted">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            {/* Notas */}
            <div>
              <label htmlFor="aaf-notes" className={labelClass}>
                {t("accommodations.field.notes")}
              </label>
              <textarea
                id="aaf-notes"
                name="notes"
                rows={3}
                placeholder="Informações adicionais sobre o imóvel..."
                className={cn(inputClass, "resize-none")}
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--red-border)] bg-[var(--red-soft)] px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-[var(--hairline)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-md)] border border-[var(--hairline)] px-4 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-4 hover:text-ink cursor-pointer"
          >
            {t("action.cancel")}
          </button>
          <button
            type="submit"
            onClick={() => formRef.current?.requestSubmit()}
            disabled={isPending}
            className="flex items-center gap-2 rounded-[var(--radius-md)] bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-orange-400 active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {t("action.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
