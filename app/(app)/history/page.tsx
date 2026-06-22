import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { HistoryTabs } from "@/components/history/HistoryTabs";
import type { Search } from "@/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;

  if (tab === "contacts") {
    redirect("/contacts");
  }

  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const admin = isAdmin(profile);

  const { data: searchesData } = await supabase
    .from("searches")
    .select("*")
    .order("created_at", { ascending: false });

  const searches = (searchesData ?? []) as Search[];

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
            Buscas passadas de alojamentos para obras.
          </p>
        </div>

        <HistoryTabs
          searches={searches}
          isAdmin={admin}
          stats={stats}
        />
      </div>
    </>
  );
}
