import { BedDouble } from "lucide-react";

export function VacancyAlert({
  vacanciesByCity,
}: {
  vacanciesByCity: Record<string, number>;
}) {
  const cities = Object.entries(vacanciesByCity);
  if (cities.length === 0) return null;

  const total = cities.reduce((sum, [, n]) => sum + n, 0);

  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--green-border)] bg-surface-2 p-5"
      style={{ boxShadow: "var(--glow-green)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--color-green-500)" }}
      />
      <div className="relative flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--green-soft)]">
          <BedDouble size={20} strokeWidth={1.5} className="text-green-400" />
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
            <span className="vacancy-pulse inline-block h-2 w-2 rounded-full bg-green-500" />
            Tens {total} {total === 1 ? "vaga disponível" : "vagas disponíveis"}
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            {cities
              .map(([city, n]) => `${n} em ${city}`)
              .join(" · ")}
            . Verifica se cobre uma obra ativa antes de iniciar nova busca.
          </p>
        </div>
      </div>
    </div>
  );
}
