"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function NewSearchButton() {
  const { t } = useI18n();

  return (
    <Link
      href="/search"
      className="btn-glass-accent flex items-center gap-2 rounded-[var(--radius-md)] px-3.5 py-2 text-sm font-medium"
    >
      <Plus size={16} strokeWidth={2} />
      {t("action.newSearch")}
    </Link>
  );
}
