"use client";

import { useState, useTransition } from "react";
import { Building, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { importAgenciesNearObra } from "@/app/(app)/history/agency-actions";

export function ImportAgenciesButton() {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function run() {
    if (!location.trim()) return;
    setResult(null);
    setIsError(false);
    startTransition(async () => {
      const res = await importAgenciesNearObra({ location });
      if (res.error) {
        setIsError(true);
        setResult(res.error);
        return;
      }
      setIsError(false);
      if (res.added === 0 && res.found === 0) {
        setResult("Nenhuma agência encontrada nessa zona.");
      } else if (res.added === 0) {
        setResult(`${res.found} encontradas, todas já estavam na base.`);
      } else {
        setResult(`${res.added} agências novas adicionadas aos Contactos.`);
        setLocation("");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-2 px-3.5 py-2 text-sm font-medium text-ink-muted transition-all duration-150 hover:text-ink active:scale-[0.99]"
      >
        <Building size={16} strokeWidth={1.5} />
        Importar agências
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-2 p-3 sm:w-auto sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <Building size={16} strokeWidth={1.5} className="text-orange-400" />
        <input
          autoFocus
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Cidade ou morada da obra…"
          className="w-full rounded-[var(--radius-sm)] border border-[var(--hairline-medium)] bg-surface-3 px-3 py-1.5 text-sm text-ink placeholder:text-ink-subtle focus:border-[var(--orange-border)] focus:outline-none sm:w-56"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={run}
          disabled={pending || !location.trim()}
          className="flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] btn-glass-accent px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 size={13} className="animate-spin" /> A procurar…
            </>
          ) : (
            "Procurar"
          )}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setResult(null);
          }}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-ink-subtle transition-colors hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>
      {result && (
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs",
            isError ? "text-red-400" : "text-green-400"
          )}
        >
          {!isError && <Check size={13} />}
          {result}
        </span>
      )}
    </div>
  );
}
