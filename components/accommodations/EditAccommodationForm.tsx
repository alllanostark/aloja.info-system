"use client";

import { useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { updateAccommodation } from "@/app/(app)/accommodations/actions";
import type { ActiveAccommodation } from "@/types";

interface EditAccommodationFormProps {
  accommodation: ActiveAccommodation;
  onClose: () => void;
}

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-orange-500 focus:outline-none transition-colors";

export function EditAccommodationForm({
  accommodation,
  onClose,
}: EditAccommodationFormProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true, onClose);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [address, setAddress] = useState(accommodation.address);
  const [city, setCity] = useState(accommodation.city ?? "");
  const [totalBeds, setTotalBeds] = useState(
    String(accommodation.total_beds)
  );
  const [monthlyRent, setMonthlyRent] = useState(
    accommodation.monthly_rent != null ? String(accommodation.monthly_rent) : ""
  );
  const [obraName, setObraName] = useState(accommodation.obra_name ?? "");
  // slice(0,10): aceita tanto 'YYYY-MM-DD' como timestamptz ('...T00:00:00Z'),
  // que o input type=date renderiza vazio (e apagaria a data ao guardar).
  const [contractStart, setContractStart] = useState(
    accommodation.contract_start?.slice(0, 10) ?? ""
  );
  const [contractEnd, setContractEnd] = useState(
    accommodation.contract_end?.slice(0, 10) ?? ""
  );
  const [ownerName, setOwnerName] = useState(accommodation.owner_name ?? "");
  const [ownerPhone, setOwnerPhone] = useState(accommodation.owner_phone ?? "");
  const [notes, setNotes] = useState(accommodation.notes ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const beds = parseInt(totalBeds, 10);
    if (isNaN(beds) || beds < 1) {
      setError("O nº de camas deve ser um número inteiro positivo.");
      return;
    }

    const rent = monthlyRent !== "" ? parseFloat(monthlyRent) : null;
    if (monthlyRent !== "" && (isNaN(rent!) || rent! < 0)) {
      setError("A renda mensal deve ser um valor positivo.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateAccommodation({
          id: accommodation.id,
          address: address.trim(),
          city: city.trim() || null,
          total_beds: beds,
          monthly_rent: rent,
          obra_name: obraName.trim() || null,
          contract_start: contractStart || null,
          contract_end: contractEnd || null,
          owner_name: ownerName.trim() || null,
          owner_phone: ownerPhone.trim() || null,
          notes: notes.trim() || null,
        });

        if (result.error) {
          setError(result.error);
        } else {
          onClose();
        }
      } catch (err) {
        // requireAdmin lança (sessão expirada) — sem isto o spinner ficava preso.
        setError(
          err instanceof Error
            ? err.message
            : "Erro ao guardar. Tenta novamente."
        );
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Editar alojamento"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          "relative z-10 w-full max-w-lg rounded-[var(--radius-xl)] border border-[var(--hairline-medium)]",
          "bg-surface-2 shadow-[var(--shadow-xl)] overflow-hidden"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--orange-soft)]">
              <Pencil size={15} strokeWidth={1.5} className="text-orange-400" />
            </div>
            <h2 className="text-base font-semibold text-ink">
              Editar Alojamento
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-ink-subtle transition-colors hover:bg-surface-4 hover:text-ink cursor-pointer"
            aria-label="Fechar"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Formulário */}
        <form
          id="edit-accommodation-form"
          onSubmit={handleSubmit}
          className="max-h-[70vh] overflow-y-auto px-6 py-5"
        >
          <div className="space-y-4">
            {/* Endereço */}
            <div>
              <label
                htmlFor="edit-address"
                className="mb-1.5 block text-xs font-medium text-ink-muted"
              >
                Endereço <span className="text-red-400">*</span>
              </label>
              <input
                id="edit-address"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua Exemple, 12, 3º"
                className={inputClass}
              />
            </div>

            {/* Cidade */}
            <div>
              <label
                htmlFor="edit-city"
                className="mb-1.5 block text-xs font-medium text-ink-muted"
              >
                Cidade
              </label>
              <input
                id="edit-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Barcelona"
                className={inputClass}
              />
            </div>

            {/* Nº camas + Renda */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="edit-total-beds"
                  className="mb-1.5 block text-xs font-medium text-ink-muted"
                >
                  Nº de camas <span className="text-red-400">*</span>
                </label>
                <input
                  id="edit-total-beds"
                  type="number"
                  min="1"
                  required
                  value={totalBeds}
                  onChange={(e) => setTotalBeds(e.target.value)}
                  placeholder="4"
                  className={cn(inputClass, "tabular")}
                />
              </div>
              <div>
                <label
                  htmlFor="edit-monthly-rent"
                  className="mb-1.5 block text-xs font-medium text-ink-muted"
                >
                  Renda mensal (€)
                </label>
                <input
                  id="edit-monthly-rent"
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  placeholder="1200"
                  className={cn(inputClass, "tabular")}
                />
              </div>
            </div>

            {/* Obra */}
            <div>
              <label
                htmlFor="edit-obra-name"
                className="mb-1.5 block text-xs font-medium text-ink-muted"
              >
                Obra associada
              </label>
              <input
                id="edit-obra-name"
                value={obraName}
                onChange={(e) => setObraName(e.target.value)}
                placeholder="Obra Hospitalet"
                className={inputClass}
              />
            </div>

            {/* Datas de contrato */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="edit-contract-start"
                  className="mb-1.5 block text-xs font-medium text-ink-muted"
                >
                  Início do contrato
                </label>
                <input
                  id="edit-contract-start"
                  type="date"
                  value={contractStart}
                  onChange={(e) => setContractStart(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="edit-contract-end"
                  className="mb-1.5 block text-xs font-medium text-ink-muted"
                >
                  Fim do contrato
                </label>
                <input
                  id="edit-contract-end"
                  type="date"
                  value={contractEnd}
                  onChange={(e) => setContractEnd(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Proprietário + telefone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="edit-owner-name"
                  className="mb-1.5 block text-xs font-medium text-ink-muted"
                >
                  Proprietário
                </label>
                <input
                  id="edit-owner-name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Josep Sala"
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="edit-owner-phone"
                  className="mb-1.5 block text-xs font-medium text-ink-muted"
                >
                  Telefone
                </label>
                <input
                  id="edit-owner-phone"
                  type="tel"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="+34 600 000 000"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Notas */}
            <div>
              <label
                htmlFor="edit-notes"
                className="mb-1.5 block text-xs font-medium text-ink-muted"
              >
                Notas
              </label>
              <textarea
                id="edit-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Informações adicionais sobre o imóvel..."
                className={cn(
                  inputClass,
                  "resize-none"
                )}
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
            form="edit-accommodation-form"
            disabled={isPending}
            className="flex items-center gap-2 rounded-[var(--radius-md)] btn-glass-accent px-4 py-2 text-sm font-medium cursor-pointer disabled:opacity-50"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Guardar alterações
          </button>
        </div>
      </motion.div>
    </div>
  );
}

interface EditAccommodationTriggerProps {
  accommodation: ActiveAccommodation;
}

export function EditAccommodationTrigger({
  accommodation,
}: EditAccommodationTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex items-center gap-1 text-xs text-ink-subtle transition-colors hover:text-orange-400 cursor-pointer"
        aria-label="Editar alojamento"
      >
        <Pencil size={13} strokeWidth={1.5} />
        Editar
      </button>

      <AnimatePresence>
        {open && (
          <EditAccommodationForm
            accommodation={accommodation}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
