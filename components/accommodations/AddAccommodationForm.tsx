"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { X, Loader2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { addAccommodation } from "@/app/(app)/accommodations/actions";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface AddAccommodationFormProps {
  onClose: () => void;
}

export function AddAccommodationForm({ onClose }: AddAccommodationFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
          err instanceof Error ? err.message : "Erro ao guardar. Tenta novamente."
        );
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Adicionar alojamento"
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
          "relative z-10 w-full max-w-lg rounded-[var(--radius-xl)] border border-[var(--hairline-medium)]",
          "bg-surface-2 shadow-[var(--shadow-xl)] overflow-hidden"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--orange-soft)]">
              <Building2 size={16} strokeWidth={1.5} className="text-orange-400" />
            </div>
            <h2 className="text-base font-semibold text-ink">
              Adicionar Alojamento
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-ink-subtle transition-colors hover:bg-surface-4 hover:text-ink cursor-pointer"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Formulário */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="max-h-[70vh] overflow-y-auto px-6 py-5"
        >
          <div className="space-y-4">
            {/* Endereço */}
            <div>
              <label htmlFor="aaf-address" className="mb-1.5 block text-xs font-medium text-ink-muted">
                Endereço <span className="text-red-400">*</span>
              </label>
              <input
                id="aaf-address"
                name="address"
                required
                placeholder="Rua Exemple, 12, 3º"
                className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-orange-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Cidade */}
            <div>
              <label htmlFor="aaf-city" className="mb-1.5 block text-xs font-medium text-ink-muted">
                Cidade
              </label>
              <input
                id="aaf-city"
                name="city"
                placeholder="Barcelona"
                className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-orange-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Nº camas + Renda */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="aaf-total-beds" className="mb-1.5 block text-xs font-medium text-ink-muted">
                  Nº de camas <span className="text-red-400">*</span>
                </label>
                <input
                  id="aaf-total-beds"
                  name="total_beds"
                  type="number"
                  min="1"
                  required
                  placeholder="4"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3.5 py-2.5 text-sm text-ink tabular placeholder:text-ink-subtle focus:border-orange-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label htmlFor="aaf-monthly-rent" className="mb-1.5 block text-xs font-medium text-ink-muted">
                  Renda mensal (€)
                </label>
                <input
                  id="aaf-monthly-rent"
                  name="monthly_rent"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="1200"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3.5 py-2.5 text-sm text-ink tabular placeholder:text-ink-subtle focus:border-orange-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Obra */}
            <div>
              <label htmlFor="aaf-obra-name" className="mb-1.5 block text-xs font-medium text-ink-muted">
                Obra associada
              </label>
              <input
                id="aaf-obra-name"
                name="obra_name"
                placeholder="Obra Hospitalet"
                className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-orange-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Datas de contrato */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="aaf-contract-start" className="mb-1.5 block text-xs font-medium text-ink-muted">
                  Início do contrato
                </label>
                <input
                  id="aaf-contract-start"
                  name="contract_start"
                  type="date"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3.5 py-2.5 text-sm text-ink focus:border-orange-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label htmlFor="aaf-contract-end" className="mb-1.5 block text-xs font-medium text-ink-muted">
                  Fim do contrato
                </label>
                <input
                  id="aaf-contract-end"
                  name="contract_end"
                  type="date"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3.5 py-2.5 text-sm text-ink focus:border-orange-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Proprietário + telefone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="aaf-owner-name" className="mb-1.5 block text-xs font-medium text-ink-muted">
                  Proprietário
                </label>
                <input
                  id="aaf-owner-name"
                  name="owner_name"
                  placeholder="Josep Sala"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-orange-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label htmlFor="aaf-owner-phone" className="mb-1.5 block text-xs font-medium text-ink-muted">
                  Telefone
                </label>
                <input
                  id="aaf-owner-phone"
                  name="owner_phone"
                  type="tel"
                  placeholder="+34 600 000 000"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-orange-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Mobilado */}
            <div>
              {/*
               * Radio group: usa <fieldset>/<legend> para associação semântica
               * correta de grupo. Os <label> individuais já envolvem os inputs
               * (associação implícita válida para radios dentro do mesmo label).
               */}
              <fieldset className="border-none p-0 m-0">
                <legend className="mb-1.5 text-xs font-medium text-ink-muted">
                  Mobilado?
                </legend>
                <div className="flex gap-3">
                  {[
                    { value: "true", label: "Sim", id: "aaf-furnished-yes" },
                    { value: "false", label: "Não (precisa mobilar)", id: "aaf-furnished-no" },
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
              <label htmlFor="aaf-notes" className="mb-1.5 block text-xs font-medium text-ink-muted">
                Notas
              </label>
              <textarea
                id="aaf-notes"
                name="notes"
                rows={3}
                placeholder="Informações adicionais sobre o imóvel..."
                className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-orange-500 focus:outline-none transition-colors"
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
            Cancelar
          </button>
          <button
            type="submit"
            form={formRef.current?.id}
            onClick={() => formRef.current?.requestSubmit()}
            disabled={isPending}
            className="flex items-center gap-2 rounded-[var(--radius-md)] bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-orange-400 active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Guardar alojamento
          </button>
        </div>
      </div>
    </div>
  );
}
