import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveAccommodation } from "@/types";

function formatDatePT(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function contractDateClass(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(dateStr + "T00:00:00");
  const diffDays = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return "text-red-400";
  if (diffDays <= 7) return "text-amber-400";
  return "text-amber-400";
}

function contractLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(dateStr + "T00:00:00");
  const diffDays = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return "expirado";
  if (diffDays === 0) return "expira hoje";
  if (diffDays === 1) return "expira amanhã";
  return `${diffDays} dias`;
}

function isExpired(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr + "T00:00:00") < today;
}

export function ContractsAlert({
  accommodations,
}: {
  accommodations: ActiveAccommodation[];
}) {
  if (accommodations.length === 0) return null;

  const expiredCount = accommodations.filter(
    (a) => a.contract_end && isExpired(a.contract_end)
  ).length;
  const soonCount = accommodations.length - expiredCount;

  const titleParts: string[] = [];
  if (expiredCount > 0)
    titleParts.push(`${expiredCount} ${expiredCount === 1 ? "expirado" : "expirados"}`);
  if (soonCount > 0)
    titleParts.push(`${soonCount} a expirar`);

  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--yellow-border)] bg-surface-2 p-5"
      style={{ boxShadow: "0 0 0 1px var(--yellow-border), 0 0 20px rgba(245,158,11,0.10)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-15 blur-3xl"
        style={{ background: "rgb(245 158 11)" }}
      />

      <div className="relative flex items-start gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]"
          style={{ background: "var(--yellow-soft)" }}
        >
          <CalendarClock size={20} strokeWidth={1.5} className="text-amber-400" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-ink">
            Contratos: {titleParts.join(" · ")}
          </h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            Verifica os contratos abaixo e renova antes da data de expiração.
          </p>

          <ul className="mt-3 flex flex-col gap-1.5">
            {accommodations.map((a) => {
              const dateStr = a.contract_end!;
              const expired = isExpired(dateStr);
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="min-w-0 truncate text-sm text-ink">
                    {a.address}
                    {a.obra_name && (
                      <span className="ml-2 text-ink-subtle">
                        · {a.obra_name}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "tabular shrink-0 text-xs font-medium",
                      expired ? "text-red-400" : "text-amber-400"
                    )}
                  >
                    {formatDatePT(dateStr)}
                    <span className="ml-1.5 font-normal opacity-70">
                      ({contractLabel(dateStr)})
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
