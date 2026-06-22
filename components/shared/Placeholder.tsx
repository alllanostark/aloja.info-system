import { TopBar } from "@/components/layout/TopBar";
import { Construction } from "lucide-react";

export function Placeholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <TopBar title={title} />
      <div className="mx-auto max-w-[1280px] px-8 py-8">
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-medium)] bg-surface-1 px-6 py-20 text-center">
          <Construction size={32} strokeWidth={1.5} className="text-orange-500" />
          <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
          <p className="mt-1 max-w-md text-sm text-ink-subtle">{description}</p>
        </div>
      </div>
    </>
  );
}
