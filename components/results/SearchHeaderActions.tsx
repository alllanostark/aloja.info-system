"use client";

import { useTransition } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { setSearchStatus } from "@/app/(app)/search/[id]/results/actions";
import type { SearchStatus } from "@/types";

export function SearchHeaderActions({
  searchId,
  status,
}: {
  searchId: string;
  status: SearchStatus;
}) {
  const [pending, startTransition] = useTransition();

  function set(newStatus: "completed" | "abandoned" | "active") {
    startTransition(async () => {
      await setSearchStatus({ searchId, status: newStatus });
    });
  }

  if (status !== "active") {
    return (
      <button
        onClick={() => set("active")}
        disabled={pending}
        className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-2 px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        Reabrir busca
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => set("abandoned")}
        disabled={pending}
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--hairline-medium)] bg-surface-2 px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-red-400"
        )}
      >
        <XCircle size={15} /> Abandonar
      </button>
      <button
        onClick={() => set("completed")}
        disabled={pending}
        className="flex items-center gap-2 rounded-[var(--radius-md)] bg-green-500 px-3.5 py-2 text-sm font-medium text-white transition-all hover:brightness-110 active:scale-[0.99]"
      >
        {pending ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <CheckCircle2 size={15} />
        )}
        Marcar concluída
      </button>
    </div>
  );
}
