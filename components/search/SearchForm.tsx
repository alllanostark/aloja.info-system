"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Users,
  Wallet,
  Clock,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Search,
} from "lucide-react";
import { cn, formatEuro } from "@/lib/utils";
import { createSearch } from "@/app/(app)/search/actions";
import { PlacesAutocomplete } from "@/components/search/PlacesAutocomplete";
import { LiquidButton } from "@/components/ui/liquid-glass-button";

const STEPS = ["Obra", "Trabalhadores", "Confirmar"];

export function SearchForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const [obraName, setObraName] = useState("");
  const [obraAddress, setObraAddress] = useState("");
  const [numWorkers, setNumWorkers] = useState(6);
  const [durationWeeks, setDurationWeeks] = useState(12);
  const [budget, setBudget] = useState(400);
  const [maxDrive, setMaxDrive] = useState(40);

  const totalBudget = numWorkers * budget;

  const canNext =
    step === 0
      ? obraAddress.trim().length > 3
      : step === 1
        ? numWorkers > 0 && budget > 0
        : true;

  function submit() {
    setError(null);
    setProgress("A procurar em 8 plataformas…");
    startTransition(async () => {
      const res = await createSearch({
        obraName,
        obraAddress,
        numWorkers,
        durationWeeks,
        budgetPerPerson: budget,
        maxDriveMinutes: maxDrive,
      });
      if (res.error || !res.searchId) {
        setError(res.error ?? "Falha ao iniciar a busca.");
        setProgress(null);
        return;
      }
      router.push(`/search/${res.searchId}/results`);
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Stepper */}
      <div className="mb-8 flex items-center">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium transition-all duration-200",
                  i < step
                    ? "border-orange-500 bg-orange-500 text-white"
                    : i === step
                      ? "border-orange-500 bg-[var(--orange-soft)] text-orange-400"
                      : "border-[var(--hairline-medium)] bg-surface-2 text-ink-subtle"
                )}
              >
                {i < step ? <Check size={16} strokeWidth={2.5} /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  i <= step ? "text-ink" : "text-ink-subtle"
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-3 h-px flex-1 transition-colors duration-300",
                  i < step ? "bg-orange-500" : "bg-[var(--hairline)]"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <div className="rounded-[var(--radius-xl)] border border-[var(--hairline-medium)] bg-surface-1 p-6">
        {/* Passo 1 — Obra */}
        {step === 0 && (
          <div className="space-y-5">
            <Field label="Nome da obra" icon={<MapPin size={16} />} htmlFor="sf-obra-name">
              <input
                id="sf-obra-name"
                value={obraName}
                onChange={(e) => setObraName(e.target.value)}
                placeholder="Ex: Obra Sagrera"
                className={inputCls}
              />
            </Field>
            <Field label="Endereço da obra" icon={<MapPin size={16} />} required htmlFor="sf-obra-address">
              <PlacesAutocomplete
                id="sf-obra-address"
                value={obraAddress}
                onChange={setObraAddress}
                placeholder="Rua, número, cidade"
              />
              <p className="mt-1.5 text-xs text-ink-subtle">
                Usado para calcular o tempo de condução até cada imóvel.
              </p>
            </Field>
          </div>
        )}

        {/* Passo 2 — Trabalhadores */}
        {step === 1 && (
          <div className="space-y-5">
            <Field label="Número de trabalhadores" icon={<Users size={16} />} required>
              <Stepper value={numWorkers} onChange={setNumWorkers} min={1} max={100} />
            </Field>
            <Field label="Duração estimada (semanas)" icon={<Clock size={16} />}>
              <Stepper value={durationWeeks} onChange={setDurationWeeks} min={1} max={104} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Orçamento / pessoa (€)" icon={<Wallet size={16} />} htmlFor="sf-budget">
                <input
                  id="sf-budget"
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className={cn(inputCls, "tabular")}
                />
              </Field>
              <Field label="Tempo máx. de carro (min)" icon={<Clock size={16} />} htmlFor="sf-max-drive">
                <input
                  id="sf-max-drive"
                  type="number"
                  value={maxDrive}
                  onChange={(e) => setMaxDrive(Number(e.target.value))}
                  className={cn(inputCls, "tabular")}
                />
              </Field>
            </div>
          </div>
        )}

        {/* Passo 3 — Confirmar */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-ink">Confirma a busca</h3>
            <div className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-surface-2 p-5">
              <Row label="Obra" value={obraName || "—"} />
              <Row label="Endereço" value={obraAddress} />
              <Row label="Trabalhadores" value={`${numWorkers}`} />
              <Row label="Duração" value={`${durationWeeks} semanas`} />
              <Row label="Orçamento / pessoa" value={formatEuro(budget)} />
              <Row label="Tempo máx. de carro" value={`${maxDrive} min`} />
              <div className="mt-3 border-t border-[var(--hairline)] pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-muted">
                    Orçamento total máximo
                  </span>
                  <span className="tabular text-xl font-bold text-orange-500">
                    {formatEuro(totalBudget)}
                    <span className="ml-1 text-xs font-normal text-ink-subtle">
                      /mês
                    </span>
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-ink-subtle">
              Vamos procurar em paralelo: Idealista, Fotocasa, Habitaclia,
              Spotahome, Uniplaces, Milanuncios, Airbnb e Vivara.
            </p>
            {progress && (
              <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--orange-border)] bg-[var(--orange-soft)] px-4 py-3 text-sm text-orange-300">
                <Loader2 size={16} className="animate-spin" />
                {progress}
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-[var(--radius-md)] border border-[var(--red-border)] bg-[var(--red-soft)] px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        {/* Navegação */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || pending}
            className={cn(
              "flex items-center gap-2 rounded-[var(--radius-md)] px-3.5 py-2 text-sm font-medium transition-colors",
              step === 0
                ? "invisible"
                : "text-ink-muted hover:bg-surface-3 hover:text-ink"
            )}
          >
            <ArrowLeft size={16} /> Voltar
          </button>

          {step < 2 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="flex items-center gap-2 rounded-[var(--radius-md)] btn-glass-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Continuar <ArrowRight size={16} />
            </button>
          ) : (
            <LiquidButton
              onClick={submit}
              disabled={pending}
              size="default"
            >
              {pending ? (
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <Search size={16} strokeWidth={1.5} />
              )}
              {pending ? "A procurar…" : "Iniciar Busca"}
            </LiquidButton>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-2 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-[var(--orange-border)] focus:outline-none focus:ring-[3px] focus:ring-[var(--orange-soft)]";

function Field({
  label,
  icon,
  required,
  htmlFor,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink-muted"
      >
        {icon && <span className="text-ink-subtle">{icon}</span>}
        {label}
        {required && <span className="text-orange-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Stepper({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-2 text-lg text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) =>
          onChange(Math.min(max, Math.max(min, Number(e.target.value))))
        }
        className={cn(inputCls, "tabular w-20 text-center")}
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-2 text-lg text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
      >
        +
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-ink-subtle">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
