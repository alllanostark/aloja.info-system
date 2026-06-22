"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
  Building2,
  Trash2,
  CalendarClock,
  Loader2,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { deleteContact, updateContactRating } from "@/app/(app)/history/actions";
import type { Contact, ContactRating } from "@/types";

const RATING_CONFIG: Record<
  ContactRating,
  { label: string; className: string }
> = {
  good: {
    label: "Bom",
    className:
      "text-green-400 bg-[var(--green-soft)] border-[var(--green-border)]",
  },
  neutral: {
    label: "Neutro",
    className: "text-ink-muted bg-surface-4 border-[var(--hairline)]",
  },
  bad: {
    label: "Mau",
    className: "text-red-400 bg-[var(--red-soft)] border-[var(--red-border)]",
  },
};

const RATING_OPTIONS: { value: ContactRating; label: string }[] = [
  { value: "good", label: "Bom" },
  { value: "neutral", label: "Neutro" },
  { value: "bad", label: "Mau" },
];

function formatLastUsed(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function ContactCard({
  contact,
  isAdmin,
  linkedCount = 0,
  highlighted = false,
}: {
  contact: Contact;
  isAdmin: boolean;
  linkedCount?: number;
  highlighted?: boolean;
}) {
  const { t } = useI18n();
  const [isPendingDelete, startDelete] = useTransition();
  const [isPendingRating, startRating] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rating = RATING_CONFIG[contact.rating];
  const lastUsed = formatLastUsed(contact.last_used);

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startDelete(async () => {
      const result = await deleteContact({ id: contact.id });
      if (result?.error) setError(result.error);
    });
  }

  function handleRatingChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRating = e.target.value as ContactRating;
    startRating(async () => {
      const result = await updateContactRating({ id: contact.id, rating: newRating });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div
      className={cn(
        "group relative rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-2 p-5",
        "transition-all duration-200 hover:border-[var(--hairline-medium)]",
        "hover:shadow-[var(--shadow-md)]",
        highlighted && "ring-1 ring-[var(--orange-border)]"
      )}
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{contact.name}</p>
          {contact.company && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-subtle">
              <Building2 size={11} strokeWidth={1.5} />
              <span className="truncate">{contact.company}</span>
            </div>
          )}
        </div>

        {/* Badge de rating */}
        {isAdmin ? (
          <select
            value={contact.rating}
            onChange={handleRatingChange}
            disabled={isPendingRating}
            className={cn(
              "cursor-pointer rounded-[var(--radius-pill)] border px-2.5 py-[3px] text-xs font-medium",
              "appearance-none focus:outline-none disabled:opacity-50",
              rating.className
            )}
          >
            {RATING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={cn(
              "inline-flex items-center rounded-[var(--radius-pill)] border px-2.5 py-[3px] text-xs font-medium",
              rating.className
            )}
          >
            {rating.label}
          </span>
        )}
      </div>

      {/* Contactos */}
      <div className="mt-3 space-y-1.5">
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="flex items-center gap-2 text-xs text-ink-subtle transition-colors hover:text-ink"
          >
            <Phone size={12} strokeWidth={1.5} />
            <span>{contact.phone}</span>
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-2 text-xs text-ink-subtle transition-colors hover:text-ink"
          >
            <Mail size={12} strokeWidth={1.5} />
            <span className="truncate">{contact.email}</span>
          </a>
        )}
        {contact.city && (
          <div className="flex items-center gap-2 text-xs text-ink-subtle">
            <MapPin size={12} strokeWidth={1.5} />
            <span>{contact.city}</span>
          </div>
        )}
      </div>

      {/* Alojamentos vinculados */}
      {linkedCount > 0 && (
        <div className="mt-3">
          <Link
            href={`/accommodations?tab=external&contact=${contact.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-orange-400 hover:underline"
          >
            <Home size={12} strokeWidth={1.5} />
            <span>
              {linkedCount} {t("contacts.linkedAccommodations")}
            </span>
          </Link>
        </div>
      )}

      {/* Notas */}
      {contact.notes && (
        <p className="mt-3 rounded-[var(--radius-sm)] bg-surface-3 px-3 py-2 text-xs leading-relaxed text-ink-muted">
          {contact.notes}
        </p>
      )}

      {/* Rodapé */}
      <div className="mt-3 flex items-center justify-between">
        {lastUsed ? (
          <div className="flex items-center gap-1 text-xs text-ink-subtle">
            <CalendarClock size={11} strokeWidth={1.5} />
            <span>Último uso: {lastUsed}</span>
          </div>
        ) : (
          <span className="text-xs text-ink-subtle">Nunca utilizado</span>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPendingDelete}
            className={cn(
              "cursor-pointer rounded-[var(--radius-sm)] p-1.5 transition-all",
              confirmDelete
                ? "bg-[var(--red-soft)] text-red-400 hover:bg-[var(--red-border)]"
                : "text-ink-subtle opacity-0 hover:bg-surface-4 hover:text-red-400 group-hover:opacity-100",
              "disabled:cursor-not-allowed disabled:opacity-40"
            )}
            title={confirmDelete ? "Clica novamente para confirmar" : "Eliminar contacto"}
          >
            {isPendingDelete ? (
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
            ) : (
              <Trash2 size={14} strokeWidth={1.5} />
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 rounded-[var(--radius-sm)] bg-[var(--red-soft)] px-3 py-1.5 text-xs text-red-400">
          {error}
        </p>
      )}

      {confirmDelete && !isPendingDelete && (
        <button
          type="button"
          onClick={() => setConfirmDelete(false)}
          className="mt-2 block w-full cursor-pointer text-center text-xs text-ink-subtle hover:text-ink"
        >
          Cancelar eliminação
        </button>
      )}
    </div>
  );
}
