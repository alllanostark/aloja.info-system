import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { TopBar } from "@/components/layout/TopBar";
import { HistoryTabs } from "@/components/history/HistoryTabs";
import type { Search, Contact } from "@/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const admin = isAdmin(profile);

  const [{ data: searchesData }, { data: contactsData }] = await Promise.all([
    supabase
      .from("searches")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("contacts")
      .select("*")
      .order("last_used", { ascending: false, nullsFirst: false }),
  ]);

  const searches = (searchesData ?? []) as Search[];
  const contacts = (contactsData ?? []) as Contact[];

  const stats = {
    total: searches.length,
    completed: searches.filter((s) => s.status === "completed").length,
    active: searches.filter((s) => s.status === "active").length,
  };

  return (
    <>
      <TopBar title="Histórico" />

      <div className="mx-auto max-w-[1280px] px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-display text-ink">
            Histórico
          </h2>
          <p className="mt-1 text-sm text-ink-subtle">
            Buscas passadas e base de contactos de proprietários e agências.
          </p>
        </div>

        <HistoryTabs
          searches={searches}
          contacts={contacts}
          isAdmin={admin}
          stats={stats}
        />
      </div>
    </>
  );
}
