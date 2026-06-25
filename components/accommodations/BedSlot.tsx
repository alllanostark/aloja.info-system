"use client";

import { useState, useTransition } from "react";
import { UserPlus, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { assignBed, markBedExit } from "@/app/(app)/accommodations/actions";
import type { BedOccupant } from "@/types";

interface BedSlotProps {
  accommodationId: string;
  bedNumber: number;
  occupant: BedOccupant | null;
  isAdmin: boolean;
}

export function BedSlot({
  accommodationId,
  bedNumber,
  occupant,
  isAdmin,
}: BedSlotProps) {
  const [isPending, startTransition] = useTransition();
  const [showAssign, setShowAssign] = useState(false);
  const [workerName, setWorkerName] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [error, setError] = useState<string | null>(null);

  const isOccupied = occupant !== null;

  function handleAssign() {
    if (!workerName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await assignBed({
          accommodationId,
          bedNumber,
          workerName: workerName.trim(),
          entryDate,
        });
        if (result.error) {
          setError(result.error);
        } else {
          setShowAssign(false);
          setWorkerName("");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao atribuir cama. Tenta novamente."
        );
      }
    });
  }

  function handleExit() {
    if (!occupant) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await markBedExit({ occupantId: occupant.id });
        if (result.error) setError(result.error);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao marcar saída. Tenta novamente."
        );
      }
    });
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border p-3 transition-all duration-150",
        isOccupied
          ? "border-[var(--red-border)] bg-[var(--red-soft)]"
          : "border-[var(--green-border)] bg-[var(--green-soft)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-xs)] text-xs font-bold tabular",
              isOccupied
                ? "bg-red-500/20 text-red-400"
                : "bg-green-500/20 text-green-400"
            )}
          >
            {bedNumber}
          </span>
          <div>
            {isOccupied ? (
              <>
                <p className="text-sm font-medium text-ink leading-tight">
                  {occupant!.worker_name ?? "Trabalhador"}
                </p>
                {occupant!.entry_date && (
                  <p className="text-xs text-ink-subtle">
                    Entrada:{" "}
                    {new Date(occupant!.entry_date + "T00:00:00").toLocaleDateString(
                      "pt-PT"
                    )}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-subtle">Cama vaga</p>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="shrink-0">
            {isOccupied ? (
              <button
                onClick={handleExit}
                disabled={isPending}
                className="flex items-center gap-1 rounded-[var(--radius-xs)] border border-[var(--red-border)] bg-[var(--red-soft)] px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/20 cursor-pointer disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <LogOut size={12} strokeWidth={1.5} />
                )}
                Marcar saída
              </button>
            ) : (
              <button
                onClick={() => setShowAssign((v) => !v)}
                disabled={isPending}
                className="flex items-center gap-1 rounded-[var(--radius-xs)] border border-[var(--green-border)] bg-[var(--green-soft)] px-2 py-1 text-xs text-green-400 transition-colors hover:bg-green-500/20 cursor-pointer disabled:opacity-50"
              >
                <UserPlus size={12} strokeWidth={1.5} />
                Adicionar
              </button>
            )}
          </div>
        )}
      </div>

      {showAssign && isAdmin && !isOccupied && (
        <div className="mt-3 space-y-2 border-t border-[var(--hairline)] pt-3">
          <input
            type="text"
            placeholder="Nome do trabalhador"
            value={workerName}
            onChange={(e) => setWorkerName(e.target.value)}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--hairline-medium)] bg-surface-3 px-3 py-1.5 text-sm text-ink placeholder:text-ink-subtle focus:border-orange-500 focus:outline-none"
          />
          <input
            type="date"
            value={entryDate}
            max={today}
            onChange={(e) => setEntryDate(e.target.value)}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--hairline-medium)] bg-surface-3 px-3 py-1.5 text-sm text-ink focus:border-orange-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAssign}
              disabled={isPending || !workerName.trim()}
              className="flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-sm)] btn-glass-accent px-3 py-1.5 text-sm font-medium cursor-pointer disabled:opacity-40"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              Confirmar
            </button>
            <button
              onClick={() => {
                setShowAssign(false);
                setError(null);
              }}
              className="rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-4 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
