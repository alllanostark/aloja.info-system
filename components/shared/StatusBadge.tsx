import { cn } from "@/lib/utils";

type Variant =
  | "available"
  | "occupied"
  | "furnish"
  | "approved"
  | "rejected"
  | "pending";

const VARIANTS: Record<
  Variant,
  { label: string; className: string }
> = {
  available: {
    label: "Disponível",
    className: "text-green-400 bg-[var(--green-soft)] border-[var(--green-border)]",
  },
  occupied: {
    label: "Ocupado",
    className: "text-red-400 bg-[var(--red-soft)] border-[var(--red-border)]",
  },
  furnish: {
    label: "Precisa Mobilar",
    className:
      "text-yellow-400 bg-[var(--yellow-soft)] border-[var(--yellow-border)]",
  },
  approved: {
    label: "Aprovado",
    className: "text-green-400 bg-[var(--green-soft)] border-[var(--green-border)]",
  },
  rejected: {
    label: "Reprovado",
    className: "text-red-400 bg-[var(--red-soft)] border-[var(--red-border)]",
  },
  pending: {
    label: "Pendente",
    className: "text-ink-muted bg-surface-4 border-[var(--hairline)]",
  },
};

export function StatusBadge({
  variant,
  label,
  className,
}: {
  variant: Variant;
  label?: string;
  className?: string;
}) {
  const v = VARIANTS[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-pill)] border px-2.5 py-[3px] text-xs font-medium",
        v.className,
        className
      )}
    >
      {label ?? v.label}
    </span>
  );
}
