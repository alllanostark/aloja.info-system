"use client";

import { useState, useTransition } from "react";
import {
  Heart,
  X,
  ExternalLink,
  BedDouble,
  Car,
  RotateCcw,
  Loader2,
  Sofa,
  MapPinned,
  Building2,
  Check,
} from "lucide-react";
import { cn, formatEuro, formatDriveTime } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PLATFORM_META, type SearchResult, type DiscardReason } from "@/types";
import {
  saveResult,
  discardResult,
  restoreResult,
} from "@/app/(app)/search/[id]/results/actions";
import { createAccommodationFromResult } from "@/app/(app)/accommodations/actions";

const REASONS: { value: DiscardReason; label: string }[] = [
  { value: "price", label: "Preço alto" },
  { value: "distance", label: "Muito longe" },
  { value: "owner", label: "Proprietário difícil" },
  { value: "condition", label: "Mau estado" },
  { value: "other", label: "Outro" },
];

export function PropertyCard({
  result,
  searchId,
  budgetPerPerson,
  maxDriveMinutes,
  isAdmin,
  isTopPick = false,
  knownZone = null,
}: {
  result: SearchResult;
  searchId: string;
  budgetPerPerson: number;
  maxDriveMinutes: number;
  isAdmin: boolean;
  isTopPick?: boolean;
  knownZone?: { label: string } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [showReasons, setShowReasons] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"month" | "week" | "day">("month");
  const [registered, setRegistered] = useState(false);
  const platform = PLATFORM_META[result.platform];

  const overBudget =
    result.cost_per_person != null && result.cost_per_person > budgetPerPerson;
  const overDrive =
    result.drive_minutes != null && result.drive_minutes > maxDriveMinutes;
  const isSaved = result.status === "saved";
  const isDiscarded = result.status === "discarded";

  // Período selecionado (divisor a partir do valor mensal)
  const divisor = period === "month" ? 1 : period === "week" ? 4.33 : 30;
  const periodSuffix =
    period === "month" ? "/mês" : period === "week" ? "/sem" : "/dia";
  const totalDisplay =
    result.total_price != null ? result.total_price / divisor : null;
  const perPersonDisplay =
    result.cost_per_person != null ? result.cost_per_person / divisor : null;

  // Excedente vs orçamento (valores no período selecionado)
  const excessPerPersonRaw = (result.cost_per_person ?? 0) - budgetPerPerson;
  const excessTotalRaw = excessPerPersonRaw * (result.num_beds ?? 0);
  const excessPerPerson = excessPerPersonRaw / divisor;
  const excessTotal = excessTotalRaw / divisor;

  // Custo diário (sempre /dia, independente do toggle)
  const dailyCostPerPerson =
    result.cost_per_person != null ? result.cost_per_person / 30 : null;
  const dailyTotal = result.total_price != null ? result.total_price / 30 : null;

  function act(fn: () => Promise<{ error?: string }>) {
    setActionError(null);
    startTransition(async () => {
      try {
        const res = await fn();
        if (res?.error) {
          setActionError(res.error);
        } else {
          setShowReasons(false);
        }
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Erro ao executar. Tenta novamente."
        );
      }
    });
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border bg-surface-2 p-5 transition-all duration-200",
        isTopPick
          ? "border-[var(--orange-border)]"
          : "border-[var(--hairline)] hover:border-[var(--hairline-medium)]",
        isDiscarded && "opacity-55"
      )}
      style={isTopPick ? { boxShadow: "var(--glow-orange)" } : undefined}
    >
      {isTopPick && (
        <span className="absolute right-0 top-0 rounded-bl-[var(--radius-md)] bg-orange-500 px-2.5 py-1 text-[11px] font-semibold text-white">
          Melhor opção
        </span>
      )}

      {/* Header: plataforma + estado */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-[var(--radius-sm)] border border-[var(--hairline-medium)] bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
          {platform.label}
        </span>
        {!result.furnished && <StatusBadge variant="furnish" />}
        {isSaved && <StatusBadge variant="approved" label="Guardado" />}
        {isDiscarded && <StatusBadge variant="rejected" label="Descartado" />}
        {knownZone != null && (
          <span
            title={knownZone.label}
            aria-label={`Zona conhecida: ${knownZone.label}`}
            className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--hairline-medium)] bg-surface-3 px-2 py-[3px] text-[11px] font-medium text-ink-muted"
          >
            <MapPinned size={13} strokeWidth={1.5} className="shrink-0 text-blue-400" />
            Zona Conhecida
          </span>
        )}
      </div>

      {/* Título + morada */}
      <h4 className="text-sm font-semibold text-ink">
        {result.title ?? "Imóvel"}
      </h4>
      <p className="mt-0.5 truncate text-xs text-ink-subtle">{result.address}</p>

      {/* Métricas */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric
          icon={<BedDouble size={14} />}
          value={`${result.num_beds ?? "—"}`}
          label="camas"
        />
        <Metric
          icon={<Car size={14} />}
          value={formatDriveTime(result.drive_minutes)}
          label="condução"
          danger={overDrive}
        />
        <Metric
          icon={<Sofa size={14} />}
          value={result.furnished ? "Sim" : "Não"}
          label="mobília"
        />
      </div>

      {/* Preços */}
      <div className="mt-4 border-t border-[var(--hairline)] pt-3">
        {/* Toggle de período */}
        <div className="mb-2 flex items-center gap-1">
          {(["month", "week", "day"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "cursor-pointer rounded-[var(--radius-sm)] px-2 py-0.5 text-[10px] font-medium transition-colors",
                period === p
                  ? "bg-surface-4 text-ink"
                  : "text-ink-subtle hover:text-ink-muted"
              )}
            >
              {p === "month" ? "Mês" : p === "week" ? "Semana" : "Dia"}
            </button>
          ))}
        </div>

        <div className="flex items-end justify-between gap-2">
          {/* Total */}
          <div>
            <div className="tabular text-lg font-bold text-ink">
              {formatEuro(totalDisplay)}
              <span className="ml-1 text-xs font-normal text-ink-subtle">
                {periodSuffix}
              </span>
            </div>
          </div>

          {/* Badge de excedente / margem */}
          <div className="flex flex-col items-center text-center">
            {excessPerPersonRaw > 0 ? (
              <>
                <span className="rounded-[var(--radius-pill)] border border-[var(--red-border)] bg-[var(--red-soft)] px-2 py-0.5 text-[10px] font-medium text-red-400">
                  +{formatEuro(excessPerPerson)}/pessoa
                </span>
                <span className="mt-0.5 text-[9px] text-red-400">
                  +{formatEuro(excessTotal)} total ({result.num_beds} camas)
                </span>
              </>
            ) : (
              <>
                <span className="rounded-[var(--radius-pill)] border border-[var(--green-border)] bg-[var(--green-soft)] px-2 py-0.5 text-[10px] font-medium text-green-400">
                  {formatEuro(Math.abs(excessPerPerson))}/pessoa abaixo
                </span>
                <span className="mt-0.5 text-[9px] text-green-400">
                  {formatEuro(Math.abs(excessTotal))} de margem
                </span>
              </>
            )}
          </div>

          {/* Custo por pessoa */}
          <div className="text-right">
            <div
              className={cn(
                "tabular text-base font-bold",
                overBudget ? "text-red-400" : "text-green-400"
              )}
            >
              {formatEuro(perPersonDisplay)}
            </div>
            <div className="text-[10px] text-ink-subtle">por pessoa</div>
          </div>
        </div>

        {/* Custo diário (sempre) */}
        <div className="mt-1.5 text-right text-[10px] text-ink-subtle">
          {formatEuro(dailyCostPerPerson)}/dia · {formatEuro(dailyTotal)}/dia
          total
        </div>
      </div>

      {/* Ações */}
      <div className="mt-4 flex items-center gap-2">
        {isAdmin && !isDiscarded && (
          <>
            <button
              onClick={() =>
                act(() =>
                  isSaved
                    ? restoreResult({ resultId: result.id, searchId })
                    : saveResult({ resultId: result.id, searchId })
                )
              }
              disabled={pending}
              className={cn(
                "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border text-xs font-medium transition-colors",
                isSaved
                  ? "border-[var(--green-border)] bg-[var(--green-soft)] text-green-400"
                  : "border-[var(--hairline-medium)] bg-surface-3 text-ink-muted hover:text-ink"
              )}
            >
              <Heart size={14} fill={isSaved ? "currentColor" : "none"} />
              {isSaved ? "Guardado" : "Guardar"}
            </button>
            <button
              onClick={() => {
                setShowReasons((v) => !v);
                setActionError(null);
              }}
              disabled={pending}
              aria-label="Descartar imóvel"
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 text-ink-muted transition-colors hover:text-red-400"
            >
              {pending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <X size={14} />
              )}
            </button>
          </>
        )}

        {isAdmin && isDiscarded && (
          <button
            onClick={() => act(() => restoreResult({ resultId: result.id, searchId }))}
            disabled={pending}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <RotateCcw size={14} /> Recuperar
          </button>
        )}

        {isAdmin && isSaved && (
          <button
            onClick={() => {
              setActionError(null);
              startTransition(async () => {
                try {
                  const res = await createAccommodationFromResult({ resultId: result.id });
                  if (res.error) {
                    setActionError(res.error);
                  } else {
                    setRegistered(true);
                  }
                } catch (err) {
                  setActionError(
                    err instanceof Error ? err.message : "Erro ao registar. Tenta novamente."
                  );
                }
              });
            }}
            disabled={pending || registered}
            title="Registar como alojamento ativo"
            className={cn(
              "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border text-xs font-medium transition-colors",
              registered
                ? "cursor-default border-[var(--green-border)] bg-[var(--green-soft)] text-green-400"
                : "border-[var(--hairline-medium)] bg-surface-3 text-ink-muted hover:border-[var(--orange-border)] hover:text-orange-400"
            )}
          >
            {pending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : registered ? (
              <>
                <Check size={14} />
                Registado em Alojamentos
              </>
            ) : (
              <>
                <Building2 size={14} strokeWidth={1.5} />
                Registar como alojamento
              </>
            )}
          </button>
        )}

        {result.external_url && (
          <a
            href={result.external_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver anúncio original"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 text-ink-muted transition-colors hover:text-orange-400"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      {actionError && (
        <p className="mt-2 text-xs text-red-400">{actionError}</p>
      )}

      {/* Picker de motivo */}
      {showReasons && (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-3 p-2">
          <p className="px-1 pb-1.5 text-[11px] text-ink-subtle">
            Motivo do descarte:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r.value}
                onClick={() =>
                  act(() =>
                    discardResult({
                      resultId: result.id,
                      searchId,
                      reason: r.value,
                    })
                  )
                }
                className="rounded-[var(--radius-sm)] border border-[var(--hairline-medium)] bg-surface-4 px-2 py-1 text-[11px] text-ink-muted transition-colors hover:border-[var(--red-border)] hover:text-red-400"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon,
  value,
  label,
  danger,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-sm)] bg-surface-3 px-2 py-1.5 text-center">
      <div
        className={cn(
          "flex items-center justify-center gap-1 tabular text-sm font-semibold",
          danger ? "text-red-400" : "text-ink"
        )}
      >
        <span className="text-ink-subtle">{icon}</span>
        {value}
      </div>
      <div className="text-[10px] text-ink-subtle">{label}</div>
    </div>
  );
}
