"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  Calendar,
  BedDouble,
  Loader2,
  Trash2,
  Euro,
} from "lucide-react";
import { cn, formatEuro } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { BedSlot } from "@/components/accommodations/BedSlot";
import { EditAccommodationTrigger } from "@/components/accommodations/EditAccommodationForm";
import { removeAccommodation } from "@/app/(app)/accommodations/actions";
import type { ActiveAccommodation, BedOccupant } from "@/types";

interface AccommodationCardProps {
  accommodation: ActiveAccommodation;
  occupants: BedOccupant[];
  isAdmin: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function needsFurnishing(accommodation: ActiveAccommodation): boolean {
  if (accommodation.furnished === false) return true;
  const notes = accommodation.notes?.toLowerCase() ?? "";
  return (
    notes.includes("sem mobília") ||
    notes.includes("sem mobilia") ||
    notes.includes("não mobilado") ||
    notes.includes("nao mobilado")
  );
}

function contractEndClass(dateStr: string | null): string {
  if (!dateStr) return "text-ink";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(dateStr + "T00:00:00");
  const diffDays = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "text-red-400";
  if (diffDays <= 30) return "text-amber-400";
  return "text-ink";
}

export function AccommodationCard({
  accommodation,
  occupants,
  isAdmin,
}: AccommodationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const occupiedBeds = occupants.filter((o) => o.exit_date === null);
  const occupiedCount = occupiedBeds.length;
  const vacantCount = accommodation.total_beds - occupiedCount;
  const costPP =
    accommodation.monthly_rent && accommodation.total_beds > 0
      ? Math.round(accommodation.monthly_rent / accommodation.total_beds)
      : null;

  const showFurnishBadge = needsFurnishing(accommodation);

  function getOccupantForBed(bedNumber: number): BedOccupant | null {
    return occupiedBeds.find((o) => o.bed_number === bedNumber) ?? null;
  }

  function handleDelete() {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await removeAccommodation({ id: accommodation.id });
      if (result.error) {
        setDeleteError(result.error);
        setConfirmDelete(false);
      }
    });
  }

  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-2 transition-all duration-200",
        "hover:border-[var(--hairline-medium)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
      )}
    >
      {/* Header do card */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className="cursor-pointer p-5"
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Endereço + cidade */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-ink tracking-display truncate">
                {accommodation.address}
              </h3>
              {accommodation.city && (
                <span className="flex items-center gap-1 text-sm text-ink-subtle">
                  <MapPin size={13} strokeWidth={1.5} />
                  {accommodation.city}
                </span>
              )}
            </div>

            {/* Obra */}
            {accommodation.obra_name && (
              <p className="mt-0.5 text-sm text-ink-muted">
                {accommodation.obra_name}
              </p>
            )}

            {/* Badges de estado */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {vacantCount > 0 ? (
                <StatusBadge
                  variant="available"
                  label={`${vacantCount} ${vacantCount === 1 ? "vaga" : "vagas"}`}
                />
              ) : (
                <StatusBadge variant="occupied" label="Cheio" />
              )}
              {showFurnishBadge && <StatusBadge variant="furnish" />}
            </div>
          </div>

          {/* Contadores de camas */}
          <div className="flex shrink-0 items-center gap-3 text-right">
            <div className="flex gap-3">
              <div className="text-center">
                <p className="tabular text-lg font-bold text-ink leading-none">
                  {accommodation.total_beds}
                </p>
                <p className="text-[10px] text-ink-subtle mt-0.5">total</p>
              </div>
              <div className="text-center">
                <p className="tabular text-lg font-bold text-red-400 leading-none">
                  {occupiedCount}
                </p>
                <p className="text-[10px] text-ink-subtle mt-0.5">ocup.</p>
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    "tabular text-lg font-bold leading-none",
                    vacantCount > 0 ? "text-green-400" : "text-ink-subtle"
                  )}
                >
                  {vacantCount}
                </p>
                <p className="text-[10px] text-ink-subtle mt-0.5">vagas</p>
              </div>
            </div>
            <div className="ml-2 text-ink-subtle transition-colors">
              {expanded ? (
                <ChevronUp size={18} strokeWidth={1.5} />
              ) : (
                <ChevronDown size={18} strokeWidth={1.5} />
              )}
            </div>
          </div>
        </div>

        {/* Meta-info: renda, custo/pessoa, proprietário, datas */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
              Renda
            </p>
            <p className="tabular text-sm font-medium text-ink">
              {formatEuro(accommodation.monthly_rent)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
              Custo/pessoa
            </p>
            <p className="tabular text-sm font-medium text-ink">
              {formatEuro(costPP)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
              Proprietário
            </p>
            <p className="text-sm font-medium text-ink truncate">
              {accommodation.owner_name ?? "—"}
            </p>
            {accommodation.owner_phone && (
              <a
                href={`tel:${accommodation.owner_phone}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 cursor-pointer"
              >
                <Phone size={11} strokeWidth={1.5} />
                {accommodation.owner_phone}
              </a>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
              Contrato
            </p>
            <p className="text-sm text-ink">
              {formatDate(accommodation.contract_start)}
              {" → "}
              <span className={cn("font-medium", contractEndClass(accommodation.contract_end))}>
                {formatDate(accommodation.contract_end)}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Secção expandida: grelha de camas */}
      {expanded && (
        <div className="border-t border-[var(--hairline)] px-5 pb-5 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <BedDouble size={16} strokeWidth={1.5} className="text-ink-subtle" />
              Grelha de camas
            </h4>
            {isAdmin && !confirmDelete && (
              <div className="flex items-center gap-3">
                <EditAccommodationTrigger accommodation={accommodation} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(true);
                  }}
                  className="flex items-center gap-1 text-xs text-ink-subtle transition-colors hover:text-red-400 cursor-pointer"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                  Remover alojamento
                </button>
              </div>
            )}
            {isAdmin && confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-muted">Tens a certeza?</span>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1 rounded-[var(--radius-xs)] bg-red-500/20 border border-[var(--red-border)] px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/30 cursor-pointer disabled:opacity-50"
                >
                  {isDeleting && (
                    <Loader2 size={12} className="animate-spin" />
                  )}
                  Confirmar
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-ink-subtle hover:text-ink cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {deleteError && (
            <p className="mb-3 text-xs text-red-400">{deleteError}</p>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from(
              { length: accommodation.total_beds },
              (_, i) => i + 1
            ).map((bedNum) => (
              <BedSlot
                key={bedNum}
                accommodationId={accommodation.id}
                bedNumber={bedNum}
                occupant={getOccupantForBed(bedNum)}
                isAdmin={isAdmin}
              />
            ))}
          </div>

          {accommodation.notes && (
            <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-surface-3 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-ink-subtle mb-1">
                Notas
              </p>
              <p className="text-sm text-ink-muted">{accommodation.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
