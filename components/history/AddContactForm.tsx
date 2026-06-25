"use client";

import { useRef, useState, useTransition } from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { addContact } from "@/app/(app)/history/actions";

const RATING_OPTIONS = [
  { value: "good", label: "Bom" },
  { value: "neutral", label: "Neutro" },
  { value: "bad", label: "Mau" },
] as const;

export function AddContactForm({ onClose }: { onClose: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await addContact(formData);
      if (result?.error) {
        setServerError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--hairline-medium)] bg-surface-2 p-6 shadow-[var(--shadow-lg)]">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Adicionar Contacto</h3>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-[var(--radius-sm)] p-1 text-ink-subtle transition-colors hover:bg-surface-4 hover:text-ink"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome *" name="name" placeholder="Ex: João Silva" required />
          <Field label="Empresa" name="company" placeholder="Ex: Imobiliária Norte" />
          <Field label="Telefone" name="phone" placeholder="+351 912 345 678" type="tel" />
          <Field label="Email" name="email" placeholder="joao@exemplo.com" type="email" />
          <Field label="Cidade" name="city" placeholder="Ex: Barcelona" />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-muted">Avaliação</label>
            <select
              name="rating"
              defaultValue="neutral"
              className={cn(
                "rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-3",
                "px-3 py-2 text-sm text-ink",
                "focus:border-[var(--hairline-medium)] focus:outline-none",
                "cursor-pointer"
              )}
            >
              {RATING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-muted">Notas</label>
          <textarea
            name="notes"
            rows={3}
            placeholder="Observações sobre o contacto, preferências, histórico…"
            className={cn(
              "w-full resize-none rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-3",
              "px-3 py-2 text-sm text-ink placeholder:text-ink-subtle",
              "focus:border-[var(--hairline-medium)] focus:outline-none"
            )}
          />
        </div>

        {serverError && (
          <p className="rounded-[var(--radius-sm)] bg-[var(--red-soft)] px-3 py-2 text-xs text-red-400">
            {serverError}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-[var(--radius-md)] px-4 py-2 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              "btn-glass-accent flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {isPending && <Loader2 size={14} strokeWidth={2} className="animate-spin" />}
            {isPending ? "A guardar…" : "Guardar Contacto"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-ink-muted">{label}</label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        className={cn(
          "rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-3",
          "px-3 py-2 text-sm text-ink placeholder:text-ink-subtle",
          "focus:border-[var(--hairline-medium)] focus:outline-none"
        )}
      />
    </div>
  );
}
