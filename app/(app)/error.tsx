"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div
        className={cn(
          "w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--red-border)]",
          "bg-surface-2 p-8",
        )}
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        {/* Glow decorativo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-10 blur-3xl"
          style={{ background: "var(--color-red-500)" }}
        />

        <div className="relative flex flex-col items-center gap-6 text-center">
          {/* Ícone */}
          <div
            className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)]"
            style={{ background: "var(--red-soft)" }}
          >
            <AlertTriangle
              size={26}
              strokeWidth={1.5}
              className="text-red-400"
            />
          </div>

          {/* Texto */}
          <div className="flex flex-col gap-2">
            <h1 className="text-lg font-semibold text-ink tracking-display">
              Algo correu mal
            </h1>
            <p className="text-sm text-ink-muted leading-relaxed">
              Ocorreu um erro ao carregar esta página. Podes tentar novamente ou
              voltar ao dashboard.
            </p>
            {error.digest && (
              <p className="mt-1 font-mono text-xs text-ink-subtle">
                ref: {error.digest}
              </p>
            )}
          </div>

          {/* Acções */}
          <div className="flex w-full flex-col gap-3">
            <button
              onClick={reset}
              className={cn(
                "w-full rounded-[var(--radius-md)] bg-orange-500 px-4 py-2.5",
                "text-sm font-medium text-white",
                "transition-colors hover:bg-orange-600 active:bg-orange-700",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2",
              )}
            >
              Tentar novamente
            </button>

            <Link
              href="/dashboard"
              className={cn(
                "w-full rounded-[var(--radius-md)] border border-[var(--hairline-medium)]",
                "bg-surface-3 px-4 py-2.5 text-center text-sm font-medium text-ink-muted",
                "transition-colors hover:border-[var(--hairline-strong)] hover:text-ink",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2",
              )}
            >
              Voltar ao Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
