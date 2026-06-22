"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function NewSearchButton() {
  const { t } = useI18n();

  return (
    <Link
      href="/search"
      className="flex items-center gap-2 rounded-[var(--radius-md)] bg-orange-500 px-3.5 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-orange-400 active:scale-[0.99]"
    >
      <Plus size={16} strokeWidth={2} />
      {t("action.newSearch")}
    </Link>
  );
}
