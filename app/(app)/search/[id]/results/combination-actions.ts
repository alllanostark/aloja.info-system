"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { SearchResult, ActiveAccommodation, CombinationSourceType } from "@/types";

export interface CombinationSources {
  searchResults: SearchResult[];
  discarded: SearchResult[];
  activeAccommodations: ActiveAccommodation[];
  externalAccommodations: ActiveAccommodation[];
}

export async function getCombinationSources({
  searchId,
}: {
  searchId: string;
}): Promise<CombinationSources> {
  const empty: CombinationSources = {
    searchResults: [],
    discarded: [],
    activeAccommodations: [],
    externalAccommodations: [],
  };

  const profile = await getCurrentProfile();
  if (!profile) return empty;

  const supabase = await createClient();

  const [
    { data: searchResults },
    { data: discarded },
    { data: activeAccommodations },
    { data: externalAccommodations },
  ] = await Promise.all([
    supabase
      .from("search_results")
      .select("*")
      .eq("search_id", searchId)
      .neq("status", "discarded"),
    supabase
      .from("search_results")
      .select("*")
      .eq("search_id", searchId)
      .eq("status", "discarded"),
    supabase
      .from("active_accommodations")
      .select("*")
      .eq("status", "active"),
    supabase
      .from("active_accommodations")
      .select("*")
      .eq("status", "external"),
  ]);

  return {
    searchResults: (searchResults ?? []) as SearchResult[],
    discarded: (discarded ?? []) as SearchResult[],
    activeAccommodations: (activeAccommodations ?? []) as ActiveAccommodation[],
    externalAccommodations:
      (externalAccommodations ?? []) as ActiveAccommodation[],
  };
}

// ─── saveCombination / deleteCombination ─────────────────────────────────────

export interface SaveCombinationItemInput {
  source_type: CombinationSourceType;
  source_id: string | null;
  override_title: string | null;
  override_beds: number | null;
  override_drive_minutes: number | null;
  override_monthly_rent: number | null;
  override_deposit: number;
  override_honorarium: number;
  override_final_price: number | null;
  position: number;
}

export async function saveCombination(input: {
  overrideId?: string | null;
  searchId: string;
  label: string;
  durationValue: number;
  durationUnit: "months" | "weeks" | "days";
  notes?: string | null;
  items: SaveCombinationItemInput[];
}): Promise<{ error: string | null; overrideId?: string }> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { overrideId, searchId, label, durationValue, durationUnit, notes, items } = input;

  if (overrideId) {
    const { error: updateErr } = await supabase
      .from("combination_overrides")
      .update({ label, duration_value: durationValue, duration_unit: durationUnit, notes: notes ?? null })
      .eq("id", overrideId);
    if (updateErr) return { error: updateErr.message };

    const { error: deleteErr } = await supabase
      .from("combination_items")
      .delete()
      .eq("combination_id", overrideId);
    if (deleteErr) return { error: deleteErr.message };

    const { error: insertErr } = await supabase
      .from("combination_items")
      .insert(items.map((it) => ({ ...it, combination_id: overrideId })));
    if (insertErr) return { error: insertErr.message };

    revalidatePath("/history");
    return { error: null, overrideId };
  }

  const { data: override, error: insertOverrideErr } = await supabase
    .from("combination_overrides")
    .insert({ search_id: searchId, label, duration_value: durationValue, duration_unit: durationUnit, notes: notes ?? null })
    .select("id")
    .single();
  if (insertOverrideErr || !override) return { error: insertOverrideErr?.message ?? "Erro ao criar composição" };

  const newId = override.id as string;

  const { error: insertItemsErr } = await supabase
    .from("combination_items")
    .insert(items.map((it) => ({ ...it, combination_id: newId })));
  if (insertItemsErr) return { error: insertItemsErr.message };

  revalidatePath("/history");
  return { error: null, overrideId: newId };
}

export async function deleteCombination({ id }: { id: string }): Promise<{ error: string | null }> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("combination_overrides")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/history");
  return { error: null };
}
