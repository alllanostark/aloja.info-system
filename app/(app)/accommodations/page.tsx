import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { TopBar } from "@/components/layout/TopBar";
import { AccommodationsList, AddAccommodationButton } from "@/components/accommodations/AccommodationsList";
import type { ActiveAccommodation, BedOccupant, Contact } from "@/types";

export const dynamic = "force-dynamic";

export default async function AccommodationsPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const admin = isAdmin(profile);

  const [{ data: accommodations }, { data: allOccupants }, { data: allContacts }] =
    await Promise.all([
      supabase
        .from("active_accommodations")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("bed_occupants")
        .select("*")
        .is("exit_date", null),
      supabase
        .from("contacts")
        .select("id, name")
        .order("name", { ascending: true }),
    ]);

  const accs = (accommodations ?? []) as ActiveAccommodation[];
  const occupants = (allOccupants ?? []) as BedOccupant[];
  const contacts = (allContacts ?? []) as Pick<Contact, "id" | "name">[];

  // Mapa contact_id -> name para lookup rapido nos cards
  const contactMap = new Map(contacts.map((c) => [c.id, c.name]));

  const items = accs.map((acc) => ({
    accommodation: acc,
    occupants: occupants.filter((o) => o.accommodation_id === acc.id),
    contactName: acc.contact_id ? (contactMap.get(acc.contact_id) ?? null) : null,
  }));

  // Sumário usa o TOTAL GERAL (todos os status)
  const totalBeds = accs.reduce((sum, a) => sum + a.total_beds, 0);
  const occupiedCount = occupants.length;
  const vacantCount = totalBeds - occupiedCount;

  return (
    <>
      <TopBar
        title="Alojamentos"
        action={<AddAccommodationButton isAdmin={admin} contacts={contacts} />}
      />

      <div className="mx-auto max-w-[1280px] px-8 py-8">
        {/* Cabeçalho */}
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-display text-ink">
              Alojamentos
            </h2>
            <p className="mt-1 text-sm text-ink-subtle">
              Gestão de ocupação por cama dos imóveis atualmente alugados.
            </p>
          </div>

          {/* Sumário rápido — totais gerais */}
          {accs.length > 0 && (
            <div className="flex shrink-0 items-center gap-5 rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-2 px-5 py-3">
              <div className="text-center">
                <p className="tabular text-xl font-bold text-ink leading-none">
                  {accs.length}
                </p>
                <p className="text-[10px] text-ink-subtle mt-0.5">imóveis</p>
              </div>
              <div className="h-8 w-px bg-[var(--hairline)]" />
              <div className="text-center">
                <p className="tabular text-xl font-bold text-ink leading-none">
                  {totalBeds}
                </p>
                <p className="text-[10px] text-ink-subtle mt-0.5">camas</p>
              </div>
              <div className="h-8 w-px bg-[var(--hairline)]" />
              <div className="text-center">
                <p className="tabular text-xl font-bold text-red-400 leading-none">
                  {occupiedCount}
                </p>
                <p className="text-[10px] text-ink-subtle mt-0.5">ocupadas</p>
              </div>
              <div className="h-8 w-px bg-[var(--hairline)]" />
              <div className="text-center">
                <p
                  className={
                    vacantCount > 0
                      ? "tabular text-xl font-bold text-green-400 leading-none"
                      : "tabular text-xl font-bold text-ink-subtle leading-none"
                  }
                >
                  {vacantCount}
                </p>
                <p className="text-[10px] text-ink-subtle mt-0.5">vagas</p>
              </div>
            </div>
          )}
        </div>

        {/* Lista de alojamentos com tabs */}
        <AccommodationsList items={items} isAdmin={admin} contacts={contacts} />
      </div>
    </>
  );
}
