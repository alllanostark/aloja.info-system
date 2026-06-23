import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { ContactsList } from "@/components/history/ContactsList";
import type { Contact } from "@/types";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id: highlightId } = await searchParams;

  const supabase = await createClient();
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");

  const admin = isAdmin(profile);

  const [{ data: contactsData }, { data: externalAccsData }] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .order("last_used", { ascending: false, nullsFirst: false }),
    supabase
      .from("active_accommodations")
      .select("id, contact_id, address, status")
      .eq("status", "external"),
  ]);

  const contacts = (contactsData ?? []) as Contact[];

  const linkedCounts: Record<string, number> = {};
  for (const acc of externalAccsData ?? []) {
    const cid = (acc as { contact_id: string | null }).contact_id;
    if (cid) {
      linkedCounts[cid] = (linkedCounts[cid] ?? 0) + 1;
    }
  }

  return (
    <>
      <TopBar title="Contactos" />

      <div className="mx-auto max-w-[1280px] px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-display text-ink">
            Contactos
          </h2>
          <p className="mt-1 text-sm text-ink-subtle">
            Proprietários e agências imobiliárias para usar nas combinações.
          </p>
        </div>

        <ContactsList
          contacts={contacts}
          isAdmin={admin}
          linkedCounts={linkedCounts}
          highlightId={highlightId}
        />
      </div>
    </>
  );
}
