"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { SearchResult, ActiveAccommodation } from "@/types";

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
