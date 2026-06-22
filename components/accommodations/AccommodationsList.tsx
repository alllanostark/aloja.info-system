"use client";

import { useState } from "react";
import { Plus, Building2 } from "lucide-react";
import { AccommodationCard } from "@/components/accommodations/AccommodationCard";
import { AddAccommodationForm } from "@/components/accommodations/AddAccommodationForm";
import type { ActiveAccommodation, BedOccupant } from "@/types";

interface AccommodationWithOccupants {
  accommodation: ActiveAccommodation;
  occupants: BedOccupant[];
}

interface AccommodationsListProps {
  items: AccommodationWithOccupants[];
  isAdmin: boolean;
}

export function AccommodationsList({ items, isAdmin }: AccommodationsListProps) {
  const [showForm, setShowForm] = useState(false);

  if (items.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] bg-surface-1 px-6 py-20 text-center">
          <Building2 size={32} strokeWidth={1.5} className="text-ink-subtle" />
          <p className="mt-4 text-base font-semibold text-ink">
            Sem alojamentos ativos
          </p>
          <p className="mt-1 max-w-sm text-sm text-ink-subtle">
            Ainda não há nenhum imóvel registado. Adiciona o primeiro alojamento
            para começar a gerir a ocupação de camas.
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-6 flex items-center gap-2 rounded-[var(--radius-md)] bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-orange-400 active:scale-[0.99] cursor-pointer"
            >
              <Plus size={16} strokeWidth={2} />
              Adicionar alojamento
            </button>
          )}
        </div>

        {showForm && (
          <AddAccommodationForm onClose={() => setShowForm(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {items.map(({ accommodation, occupants }) => (
          <AccommodationCard
            key={accommodation.id}
            accommodation={accommodation}
            occupants={occupants}
            isAdmin={isAdmin}
          />
        ))}
      </div>

      {showForm && (
        <AddAccommodationForm onClose={() => setShowForm(false)} />
      )}
    </>
  );
}

// Botão de adicionar para a TopBar (exportado separadamente)
export function AddAccommodationButton({
  isAdmin,
}: {
  isAdmin: boolean;
}) {
  const [showForm, setShowForm] = useState(false);

  if (!isAdmin) return null;

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 rounded-[var(--radius-md)] bg-orange-500 px-3.5 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-orange-400 active:scale-[0.99] cursor-pointer"
      >
        <Plus size={16} strokeWidth={2} />
        Adicionar Alojamento
      </button>

      {showForm && (
        <AddAccommodationForm onClose={() => setShowForm(false)} />
      )}
    </>
  );
}
