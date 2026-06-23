"use client";

import { useState } from "react";
import { Plus, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { AccommodationCard } from "@/components/accommodations/AccommodationCard";
import { AddAccommodationForm } from "@/components/accommodations/AddAccommodationForm";
import type { ActiveAccommodation, AccommodationStatus, BedOccupant } from "@/types";

type TabStatus = "active" | "inactive" | "external";

interface AccommodationWithOccupants {
  accommodation: ActiveAccommodation;
  occupants: BedOccupant[];
  contactName?: string | null;
}

interface AccommodationsListProps {
  items: AccommodationWithOccupants[];
  isAdmin: boolean;
  contacts?: { id: string; name: string }[];
  initialTab?: string;
  initialContactId?: string;
}

export function AccommodationsList({
  items,
  isAdmin,
  contacts = [],
  initialTab,
  initialContactId,
}: AccommodationsListProps) {
  const { t } = useI18n();
  const validInitialTab: TabStatus =
    initialTab === "external" || initialTab === "inactive" ? initialTab : "active";
  const [activeTab, setActiveTab] = useState<TabStatus>(validInitialTab);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"searched" | "external">("searched");

  const countByStatus = (status: TabStatus) =>
    items.filter((i) => (i.accommodation.status ?? "active") === status).length;

  const filtered = items.filter((i) => {
    const matchesTab = (i.accommodation.status ?? "active") === activeTab;
    const matchesContact = initialContactId
      ? i.accommodation.contact_id === initialContactId
      : true;
    return matchesTab && matchesContact;
  });

  const tabs: { id: TabStatus; label: string }[] = [
    { id: "active", label: t("accommodations.tabs.active") },
    { id: "inactive", label: t("accommodations.tabs.inactive") },
    { id: "external", label: t("accommodations.tabs.external") },
  ];

  function openForm(mode: "searched" | "external") {
    setFormMode(mode);
    setShowForm(true);
  }

  return (
    <>
      {/* Barra de abas */}
      <div className="mb-6 flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-2 p-1 w-fit">
        {tabs.map((tab) => {
          const count = countByStatus(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium",
                "transition-all duration-150",
                activeTab === tab.id
                  ? "bg-surface-4 text-ink shadow-[var(--shadow-xs)]"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-[var(--radius-pill)] px-1.5 py-0.5 text-[10px] font-semibold tabular",
                  activeTab === tab.id
                    ? "bg-surface-5 text-ink-muted"
                    : "bg-surface-3 text-ink-subtle"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Conteúdo da aba */}
      {filtered.length === 0 ? (
        <EmptyState
          tab={activeTab}
          isAdmin={isAdmin}
          onAdd={() => openForm(activeTab === "external" ? "external" : "searched")}
          t={t}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map(({ accommodation, occupants, contactName }) => (
            <AccommodationCard
              key={accommodation.id}
              accommodation={accommodation}
              occupants={occupants}
              isAdmin={isAdmin}
              contactName={contactName}
            />
          ))}
        </div>
      )}

      {showForm && (
        <AddAccommodationForm
          onClose={() => setShowForm(false)}
          initialMode={formMode}
          contacts={contacts}
        />
      )}
    </>
  );
}

function EmptyState({
  tab,
  isAdmin,
  onAdd,
  t,
}: {
  tab: TabStatus;
  isAdmin: boolean;
  onAdd: () => void;
  t: (key: Parameters<ReturnType<typeof useI18n>["t"]>[0]) => string;
}) {
  if (tab === "external") {
    return (
      <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] bg-surface-1 px-6 py-20 text-center">
        <Building2 size={32} strokeWidth={1.5} className="text-ink-subtle" />
        <p className="mt-4 max-w-sm text-sm text-ink-subtle">
          {t("accommodations.external.empty")}
        </p>
        {isAdmin && (
          <button
            onClick={onAdd}
            className="mt-6 flex items-center gap-2 rounded-[var(--radius-md)] bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-orange-400 active:scale-[0.99] cursor-pointer"
          >
            <Plus size={16} strokeWidth={2} />
            {t("accommodations.external.emptyCta")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] bg-surface-1 px-6 py-20 text-center">
      <Building2 size={32} strokeWidth={1.5} className="text-ink-subtle" />
      <p className="mt-4 text-base font-semibold text-ink">
        {tab === "inactive" ? t("accommodations.empty.inactive") : t("accommodations.empty.active")}
      </p>
      <p className="mt-1 max-w-sm text-sm text-ink-subtle">
        {tab === "inactive"
          ? t("accommodations.empty.inactiveSub")
          : t("accommodations.empty.activeSub")}
      </p>
      {isAdmin && tab === "active" && (
        <button
          onClick={onAdd}
          className="mt-6 flex items-center gap-2 rounded-[var(--radius-md)] bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-orange-400 active:scale-[0.99] cursor-pointer"
        >
          <Plus size={16} strokeWidth={2} />
          {t("accommodations.empty.add")}
        </button>
      )}
    </div>
  );
}

// Botão de adicionar para a TopBar (exportado separadamente)
export function AddAccommodationButton({
  isAdmin,
  contacts,
}: {
  isAdmin: boolean;
  contacts?: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);

  if (!isAdmin) return null;

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 rounded-[var(--radius-md)] bg-orange-500 px-3.5 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-orange-400 active:scale-[0.99] cursor-pointer"
      >
        <Plus size={16} strokeWidth={2} />
        {t("accommodations.form.title")}
      </button>

      {showForm && (
        <AddAccommodationForm
          onClose={() => setShowForm(false)}
          contacts={contacts}
        />
      )}
    </>
  );
}
