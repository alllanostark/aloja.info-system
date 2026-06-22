import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";
import type { LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  delta,
  deltaType = "neutral",
  icon: Icon,
  accent = "default",
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  accent?: "default" | "orange" | "green";
  prefix?: string;
  suffix?: string;
}) {
  const valueColor =
    accent === "orange"
      ? "text-orange-500"
      : accent === "green"
        ? "text-green-500"
        : "text-ink";

  const deltaColor =
    deltaType === "positive"
      ? "text-green-400"
      : deltaType === "negative"
        ? "text-red-400"
        : "text-ink-subtle";

  return (
    <div
      className={cn(
        "group relative rounded-[var(--radius-lg)] border bg-surface-2 p-6",
        "border-[var(--hairline)] transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-[var(--hairline-medium)]",
        "hover:shadow-[var(--shadow-md)]"
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm text-ink-subtle">{label}</span>
        {Icon && (
          <Icon
            className="text-ink-subtle transition-colors group-hover:text-orange-500"
            size={20}
            strokeWidth={1.5}
          />
        )}
      </div>
      <div className={cn("mt-3 text-4xl font-bold tabular tracking-display-tight", valueColor)}>
        <CountUp value={value} prefix={prefix} suffix={suffix} />
      </div>
      {delta && (
        <div className={cn("mt-2 text-xs", deltaColor)}>{delta}</div>
      )}
    </div>
  );
}
