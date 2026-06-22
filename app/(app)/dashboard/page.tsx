import { Building2, BedDouble, Search as SearchIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/TopBar";
import { MetricCard } from "@/components/shared/MetricCard";
import { VacancyAlert } from "@/components/dashboard/VacancyAlert";
import { ContractsAlert } from "@/components/dashboard/ContractsAlert";
import { RecentSearches } from "@/components/dashboard/RecentSearches";
import { NewSearchButton } from "@/components/shared/NewSearchButton";
import type { AccommodationOccupancy, ActiveAccommodation, Search } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30Days = new Date(today);
  in30Days.setDate(today.getDate() + 30);
  const in30DaysIso = in30Days.toISOString().slice(0, 10);

  const [
    { data: occupancy },
    { data: recentSearches },
    { count: activeCount },
    { data: expiringContracts },
  ] = await Promise.all([
    supabase.from("accommodation_occupancy").select("*"),
    supabase
      .from("searches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("searches")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("active_accommodations")
      .select(
        "id, address, city, obra_name, contract_end, furnished, monthly_rent, total_beds, contract_start, owner_name, owner_phone, notes, lat, lng, search_id, created_at, updated_at"
      )
      .not("contract_end", "is", null)
      .lte("contract_end", in30DaysIso)
      .order("contract_end", { ascending: true }),
  ]);

  const occ = (occupancy ?? []) as AccommodationOccupancy[];
  const searches = (recentSearches ?? []) as Search[];
  const expiring = (expiringContracts ?? []) as ActiveAccommodation[];

  const totalAccommodations = occ.length;
  const totalVacancies = occ.reduce((sum, a) => sum + (a.vacant ?? 0), 0);
  const totalBeds = occ.reduce((sum, a) => sum + (a.total_beds ?? 0), 0);
  const vacanciesByCity = occ
    .filter((a) => a.vacant > 0)
    .reduce<Record<string, number>>((acc, a) => {
      const city = a.city ?? "Sem cidade";
      acc[city] = (acc[city] ?? 0) + a.vacant;
      return acc;
    }, {});

  const hasAlerts = totalVacancies > 0 || expiring.length > 0;

  return (
    <>
      <TopBar title="Dashboard" action={<NewSearchButton />} />

      <div className="mx-auto max-w-[1280px] px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-display text-ink">
            Visão Geral
          </h2>
          <p className="mt-1 text-sm text-ink-subtle">
            Estado atual dos alojamentos e buscas em curso.
          </p>
        </div>

        {/* Alertas */}
        {hasAlerts && (
          <div className="mb-6 flex flex-col gap-3">
            {totalVacancies > 0 && (
              <VacancyAlert vacanciesByCity={vacanciesByCity} />
            )}
            <ContractsAlert accommodations={expiring} />
          </div>
        )}

        {/* Métricas */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Alojamentos Ativos"
            value={totalAccommodations}
            icon={Building2}
          />
          <MetricCard
            label="Vagas Disponíveis"
            value={totalVacancies}
            icon={BedDouble}
            accent={totalVacancies > 0 ? "green" : "default"}
            delta={totalVacancies > 0 ? "Prontas a ocupar" : "Sem vagas"}
            deltaType={totalVacancies > 0 ? "positive" : "neutral"}
          />
          <MetricCard label="Camas Totais" value={totalBeds} icon={BedDouble} />
          <MetricCard
            label="Buscas Ativas"
            value={activeCount ?? 0}
            icon={SearchIcon}
            accent="orange"
          />
        </div>

        {/* Buscas recentes */}
        <div className="mt-10">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-subtle">
            Buscas Recentes
          </h3>
          <RecentSearches searches={searches} />
        </div>
      </div>
    </>
  );
}
