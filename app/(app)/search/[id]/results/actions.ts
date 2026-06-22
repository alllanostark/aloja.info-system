"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { DiscardReason } from "@/types";

export async function saveResult({
  resultId,
  searchId,
}: {
  resultId: string;
  searchId: string;
}): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase
      .from("search_results")
      .update({ status: "saved" })
      .eq("id", resultId);
    if (error) return { error: error.message };
    revalidatePath(`/search/${searchId}/results`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function discardResult({
  resultId,
  searchId,
  reason,
  notes,
}: {
  resultId: string;
  searchId: string;
  reason: DiscardReason;
  notes?: string;
}): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase
      .from("search_results")
      .update({ status: "discarded" })
      .eq("id", resultId);
    if (error) return { error: error.message };
    await supabase
      .from("discarded_results")
      .insert({ result_id: resultId, reason, notes: notes || null });
    revalidatePath(`/search/${searchId}/results`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function restoreResult({
  resultId,
  searchId,
}: {
  resultId: string;
  searchId: string;
}): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase
      .from("search_results")
      .update({ status: "new" })
      .eq("id", resultId);
    if (error) return { error: error.message };
    await supabase.from("discarded_results").delete().eq("result_id", resultId);
    revalidatePath(`/search/${searchId}/results`);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}

export async function setSearchStatus({
  searchId,
  status,
}: {
  searchId: string;
  status: "active" | "completed" | "abandoned";
}): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase
      .from("searches")
      .update({ status })
      .eq("id", searchId);
    if (error) return { error: error.message };
    revalidatePath(`/search/${searchId}/results`);
    revalidatePath("/dashboard");
    revalidatePath("/history");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro." };
  }
}
