"use client";

import { useMemo, useState } from "react";
import {
  LayoutGrid,
  Map as MapIcon,
  Home,
  Layers,
  Sofa,
  BookmarkCheck,
  AlertTriangle,
  Send,
  Check as CheckIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildProposalText, whatsappUrl } from "@/lib/proposal";
import { PropertyCard } from "./PropertyCard";
import { CombinationCard } from "./CombinationCard";
import { PropertyMap } from "./PropertyMap";
import { generateCombinations } from "@/lib/combinations";
import { matchKnownZone, type AccommodationGeoRef } from "@/lib/zones";
import type { SearchResult, Search } from "@/types";

type Filter = "all" | "saved" | "discarded";

export function ResultsView({
  search,
  results,
  isAdmin,
  knownAccommodations = [],
}: {
  search: Search;
  results: SearchResult[];
  isAdmin: boolean;
  knownAccommodations?: AccommodationGeoRef[];
}) {
  const [view, setView] = useState<"list" | "map">("list");
  const [filter, setFilter] = useState<Filter>("all");
  const [shareLabel, setShareLabel] = useState<"default" | "copied">("default");

  function handleShareProposal() {
    const text = buildProposalText(saved, {
      obraName: search.obra_name,
      numWorkers: search.num_workers,
    });
    navigator.clipboard.writeText(text).catch(() => undefined);
    window.open(whatsappUrl(text), "_blank");
    setShareLabel("copied");
    setTimeout(() => setShareLabel("default"), 2000);
  }

  const active = results.filter((r) => r.status !== "discarded");
  const discarded = results.filter((r) => r.status === "discarded");
  const saved = results.filter((r) => r.status === "saved");

  // Combinações calculadas ao vivo a partir dos resultados ativos
  const combos = useMemo(
    () =>
      generateCombinations(active, {
        workersNeeded: search.num_workers,
        budgetPerPerson: search.budget_per_person,
        maxDriveMinutes: search.max_drive_minutes,
      }),
    [active, search]
  );

  const singles = combos.singles;
  const combinations = [...combos.doubles, ...combos.triples];

  // Individuais: furnished primeiro, depois sem mobília
  const individuals = [...active].sort((a, b) => {
    if (a.furnished !== b.furnished) return a.furnished ? -1 : 1;
    return (a.cost_per_person ?? 1e9) - (b.cost_per_person ?? 1e9);
  });
  const furnished = individuals.filter((r) => r.furnished !== false);
  const unfurnished = individuals.filter((r) => r.furnished === false);

  const shown =
    filter === "saved" ? saved : filter === "discarded" ? discarded : individuals;

  return (
    <div>
      {/* Banner de demonstração */}
      {search.is_demo && (
        <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--red-border)] bg-[var(--red-soft)] p-4">
          <AlertTriangle
            size={18}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0 text-red-400"
          />
          <p className="text-sm font-medium text-red-400">
            Resultados de DEMONSTRAÇÃO - imóveis fictícios gerados para teste. Não contactar nem aprovar.
          </p>
        </div>
      )}

      {/* Controlos */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-1 p-1">
          {(
            [
              ["all", `Todos (${active.length})`],
              ["saved", `Guardados (${saved.length})`],
              ["discarded", `Descartados (${discarded.length})`],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f
                  ? "bg-surface-3 text-ink"
                  : "text-ink-subtle hover:text-ink-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--hairline)] bg-surface-1 p-1">
          <ToggleBtn active={view === "list"} onClick={() => setView("list")}>
            <LayoutGrid size={14} /> Lista
          </ToggleBtn>
          <ToggleBtn active={view === "map"} onClick={() => setView("map")}>
            <MapIcon size={14} /> Mapa
          </ToggleBtn>
        </div>
      </div>

      {filter === "discarded" && (
        <p className="mb-4 text-[11px] text-ink-subtle">
          Os descartados abaixo são específicos desta busca e não afetam outras.
        </p>
      )}

      {view === "map" ? (
        <PropertyMap search={search} results={shown} />
      ) : (
        <div className="space-y-10">
          {/* Combinações (só na vista "Todos") */}
          {filter === "all" && combinations.length > 0 && (
            <Section
              icon={<Layers size={16} />}
              title="Combinações sugeridas"
              subtitle={`Juntar imóveis para cobrir os ${search.num_workers} trabalhadores`}
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {combinations.map((combo) => (
                  <CombinationCard
                    key={combo.propertyIds.join("-")}
                    combo={combo}
                    workersNeeded={search.num_workers}
                    searchId={search.id}
                    budgetPerPerson={search.budget_per_person}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Propostas Ativas (guardados) */}
          {filter === "all" && saved.length > 0 && (
            <Section
              icon={<BookmarkCheck size={16} />}
              title={`Propostas Ativas (${saved.length})`}
              subtitle="Imóveis guardados para análise e aprovação"
              action={
                <button
                  onClick={handleShareProposal}
                  className={cn(
                    "flex items-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-medium transition-all",
                    shareLabel === "copied"
                      ? "border-[var(--green-border)] bg-[var(--green-soft)] text-green-400"
                      : "border-[var(--hairline-medium)] bg-surface-3 text-ink-muted hover:border-[var(--orange-border)] hover:text-orange-400"
                  )}
                >
                  {shareLabel === "copied" ? (
                    <>
                      <CheckIcon size={13} strokeWidth={1.5} /> Copiado
                    </>
                  ) : (
                    <>
                      <Send size={13} strokeWidth={1.5} /> Partilhar proposta
                    </>
                  )}
                </button>
              }
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {saved.map((r) => {
                  const zone = matchKnownZone(r, knownAccommodations);
                  return (
                    <PropertyCard
                      key={r.id}
                      result={r}
                      searchId={search.id}
                      budgetPerPerson={search.budget_per_person}
                      maxDriveMinutes={search.max_drive_minutes}
                      isAdmin={isAdmin}
                      knownZone={zone.known && zone.label ? { label: zone.label } : null}
                    />
                  );
                })}
              </div>
            </Section>
          )}

          {/* Soluções únicas em destaque (só "Todos") */}
          {filter === "all" && singles.length > 0 && (
            <Section
              icon={<Home size={16} />}
              title="Soluções únicas"
              subtitle="Imóveis que cobrem todos os trabalhadores sozinhos"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {singles.map((s, i) => {
                  const zone = matchKnownZone(s.properties[0], knownAccommodations);
                  return (
                    <PropertyCard
                      key={s.properties[0].id}
                      result={s.properties[0]}
                      searchId={search.id}
                      budgetPerPerson={search.budget_per_person}
                      maxDriveMinutes={search.max_drive_minutes}
                      isAdmin={isAdmin}
                      isTopPick={i === 0}
                      knownZone={zone.known && zone.label ? { label: zone.label } : null}
                    />
                  );
                })}
              </div>
            </Section>
          )}

          {/* Lista principal (respeita o filtro) */}
          <Section
            icon={<LayoutGrid size={16} />}
            title={
              filter === "saved"
                ? "Guardados"
                : filter === "discarded"
                  ? "Descartados"
                  : "Todos os imóveis"
            }
            subtitle={
              filter === "all"
                ? `${furnished.length} mobilados · ${unfurnished.length} a mobilar`
                : undefined
            }
          >
            {shown.length === 0 ? (
              <EmptyState filter={filter} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((r) => {
                  const zone = matchKnownZone(r, knownAccommodations);
                  return (
                    <PropertyCard
                      key={r.id}
                      result={r}
                      searchId={search.id}
                      budgetPerPerson={search.budget_per_person}
                      maxDriveMinutes={search.max_drive_minutes}
                      isAdmin={isAdmin}
                      knownZone={zone.known && zone.label ? { label: zone.label } : null}
                    />
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}


function Section({
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-orange-400">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            {subtitle && <p className="text-xs text-ink-subtle">{subtitle}</p>}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const msg =
    filter === "saved"
      ? "Ainda não guardaste nenhum imóvel."
      : filter === "discarded"
        ? "Nenhum imóvel descartado."
        : "Sem resultados para esta busca.";
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] bg-surface-1 px-6 py-12 text-center">
      <Sofa size={26} strokeWidth={1.5} className="text-ink-subtle" />
      <p className="mt-3 text-sm text-ink-muted">{msg}</p>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-surface-3 text-ink" : "text-ink-subtle hover:text-ink-muted"
      )}
    >
      {children}
    </button>
  );
}
