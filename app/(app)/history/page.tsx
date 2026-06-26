import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { HistoryTabs } from "@/components/history/HistoryTabs";
import { calculateFinancials } from "@/lib/combinations";
import type { Search, CombinationSourceType } from "@/types";
import type { FinancialItemInput } from "@/lib/combinations";
import type {
  CombinationSummary,
  SavedCombinationItem,
} from "@/components/history/CombinationsList";

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

  const { data: overridesData } = await supabase
    .from("combination_overrides")
    .select("*, combination_items(*), searches(obra_name, num_workers, budget_per_person)")
    .order("created_at", { ascending: false });

  const combinations: CombinationSummary[] = (overridesData ?? []).map(
    (ov: Record<string, unknown>) => {
      const combinationItems = (ov.combination_items as Record<string, unknown>[] | null) ?? [];
      const searchRow = ov.searches as {
        obra_name: string | null;
        num_workers: number;
        budget_per_person: number;
      } | null;
      const workersNeeded = searchRow?.num_workers ?? 1;

      const financialInputs: FinancialItemInput[] = combinationItems.map((it) => ({
        beds: (it.override_beds as number | null) ?? 0,
        driveMinutes: (it.override_drive_minutes as number | null) ?? null,
        monthlyRent: (it.override_monthly_rent as number | null) ?? 0,
        deposit: (it.override_deposit as number) ?? 0,
        honorarium: (it.override_honorarium as number) ?? 0,
        finalPrice: (it.override_final_price as number | null) ?? null,
      }));

      const fin = calculateFinancials(
        financialInputs,
        { value: ov.duration_value as number, unit: ov.duration_unit as "months" | "weeks" | "days" },
        workersNeeded
      );

      // Itens detalhados para o modal de visualização, ordenados pela posição
      // gravada (mantém a ordem em que o utilizador compôs a combinação).
      const items: SavedCombinationItem[] = combinationItems
        .map((it) => ({
          id: it.id as string,
          sourceType: (it.source_type as CombinationSourceType) ?? "manual",
          sourceId: (it.source_id as string | null) ?? null,
          title: (it.override_title as string | null) ?? null,
          beds: (it.override_beds as number | null) ?? 0,
          driveMinutes: (it.override_drive_minutes as number | null) ?? null,
          monthlyRent: (it.override_monthly_rent as number | null) ?? 0,
          deposit: (it.override_deposit as number) ?? 0,
          honorarium: (it.override_honorarium as number) ?? 0,
          finalPrice: (it.override_final_price as number | null) ?? null,
          position: (it.position as number) ?? 0,
        }))
        .sort((a, b) => a.position - b.position);

      return {
        id: ov.id as string,
        label: ov.label as string,
        obraName: searchRow?.obra_name ?? null,
        itemCount: combinationItems.length,
        netCost: fin.netCost,
        durationValue: ov.duration_value as number,
        durationUnit: ov.duration_unit as "months" | "weeks" | "days",
        notes: (ov.notes as string | null) ?? null,
        workersNeeded,
        searchId: ov.search_id as string,
        budgetPerPerson: searchRow?.budget_per_person ?? 400,
        items,
        financials: fin,
      };
    }
  );

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
          combinations={combinations}
        />
      </div>
    </>
  );
}
