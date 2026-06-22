import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin,
  Users,
  Wallet,
  Clock,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { TopBar } from "@/components/layout/TopBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ResultsView } from "@/components/results/ResultsView";
import { SearchHeaderActions } from "@/components/results/SearchHeaderActions";
import { formatEuro } from "@/lib/utils";
import type { AccommodationGeoRef } from "@/lib/zones";
import type { Search, SearchResult, SearchStatus } from "@/types";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<
  SearchStatus,
  { variant: "pending" | "approved" | "rejected"; label: string }
> = {
  active: { variant: "pending", label: "Ativa" },
  completed: { variant: "approved", label: "Concluída" },
  abandoned: { variant: "rejected", label: "Abandonada" },
};

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const admin = isAdmin(profile);

  const [{ data: searchData }, { data: resultsData }, { data: accommodationsData }] =
    await Promise.all([
      supabase.from("searches").select("*").eq("id", id).single(),
      supabase
        .from("search_results")
        .select("*")
        .eq("search_id", id)
        .order("cost_per_person", { ascending: true, nullsFirst: false }),
      supabase
        .from("active_accommodations")
        .select("id, address, city, lat, lng, obra_name")
        .not("lat", "is", null)
        .not("lng", "is", null),
    ]);

  if (!searchData) notFound();
  const search = searchData as Search;
  const results = (resultsData ?? []) as SearchResult[];
  const knownAccommodations = (accommodationsData ?? []) as AccommodationGeoRef[];

  const badge = STATUS_BADGE[search.status];

  // Alerta de orçamento: 3+ dias, busca ativa, sem nada dentro do orçamento
  const ageDays =
    (Date.now() - new Date(search.created_at).getTime()) / 86_400_000;
  const hasWithinBudget = results.some(
    (r) =>
      r.status !== "discarded" &&
      r.cost_per_person != null &&
      r.cost_per_person <= search.budget_per_person
  );
  const showBudgetAlert =
    search.status === "active" && ageDays >= 3 && !hasWithinBudget;

  return (
    <>
      <TopBar
        title="Resultados"
        action={
          admin && <SearchHeaderActions searchId={search.id} status={search.status} />
        }
      />

      <div className="mx-auto max-w-[1280px] px-8 py-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-ink-subtle transition-colors hover:text-ink-muted"
        >
          <ArrowLeft size={14} /> Dashboard
        </Link>

        {/* Cabeçalho da busca */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-display text-ink">
                {search.obra_name ?? "Busca"}
              </h2>
              <StatusBadge variant={badge.variant} label={badge.label} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-ink-subtle">
              <span className="flex items-center gap-1.5">
                <MapPin size={14} /> {search.obra_address}
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={14} /> {search.num_workers} trabalhadores
              </span>
              <span className="flex items-center gap-1.5">
                <Wallet size={14} />{" "}
                <span className="tabular">
                  {formatEuro(search.budget_per_person)}
                </span>
                /pessoa
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} /> máx {search.max_drive_minutes} min
              </span>
            </div>
          </div>
        </div>

        {/* Alerta de orçamento */}
        {showBudgetAlert && (
          <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--yellow-border)] bg-[var(--yellow-soft)] p-4">
            <AlertTriangle
              size={20}
              strokeWidth={1.5}
              className="mt-0.5 shrink-0 text-yellow-400"
            />
            <div>
              <p className="text-sm font-medium text-yellow-400">
                Nenhum resultado dentro do orçamento de{" "}
                {formatEuro(search.budget_per_person)}/pessoa
              </p>
              <p className="mt-0.5 text-sm text-ink-muted">
                Já passaram {Math.floor(ageDays)} dias. Considera alargar o limite
                para {formatEuro(450)}/pessoa.
              </p>
            </div>
          </div>
        )}

        {results.length === 0 ? (
          <div className="flex flex-col items-center rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] bg-surface-1 px-6 py-16 text-center">
            <p className="text-sm font-medium text-ink-muted">
              Sem resultados encontrados
            </p>
            <p className="mt-1 text-sm text-ink-subtle">
              Nenhuma plataforma devolveu imóveis para esta busca.
            </p>
          </div>
        ) : (
          <ResultsView
            search={search}
            results={results}
            isAdmin={admin}
            knownAccommodations={knownAccommodations}
          />
        )}
      </div>
    </>
  );
}
