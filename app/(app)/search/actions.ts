"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { geocode, driveMinutes } from "@/lib/maps";
import { searchAllPlatforms, type ScrapedListing } from "@/lib/apify";

export interface CreateSearchInput {
  obraName: string;
  obraAddress: string;
  numWorkers: number;
  durationWeeks: number | null;
  budgetPerPerson: number;
  maxDriveMinutes: number;
}

export interface CreateSearchResult {
  searchId?: string;
  error?: string;
  platformStatus?: { platform: string; status: string; count: number }[];
}

const DEFAULT_OBRA = { lat: 41.3874, lng: 2.1686 }; // Barcelona centro (fallback)

export async function createSearch(
  input: CreateSearchInput
): Promise<CreateSearchResult> {
  try {
    const profile = await requireAdmin();
    const supabase = await createClient();

    // 1. Geocode da obra
    const geo = await geocode(input.obraAddress);
    const obraLat = geo?.lat ?? null;
    const obraLng = geo?.lng ?? null;

    // 2. Criar a busca (is_demo definido depois do scraping — actualiza via update)
    const { data: search, error: searchErr } = await supabase
      .from("searches")
      .insert({
        created_by: profile.id,
        obra_name: input.obraName || null,
        obra_address: geo?.formattedAddress ?? input.obraAddress,
        obra_lat: obraLat,
        obra_lng: obraLng,
        num_workers: input.numWorkers,
        duration_weeks: input.durationWeeks,
        budget_per_person: input.budgetPerPerson,
        max_drive_minutes: input.maxDriveMinutes,
        status: "active",
        is_demo: false, // valor provisório; corrigido abaixo se necessário
      })
      .select()
      .single();

    if (searchErr || !search) {
      return { error: searchErr?.message ?? "Falha ao criar a busca." };
    }

    // 3. Scraping paralelo das plataformas
    const { listings, platformStatus } = await searchAllPlatforms({
      obraAddress: geo?.formattedAddress ?? input.obraAddress,
      obraCity: geo?.city ?? null,
      obraLat: obraLat ?? DEFAULT_OBRA.lat,
      obraLng: obraLng ?? DEFAULT_OBRA.lng,
      numWorkers: input.numWorkers,
      budgetPerPerson: input.budgetPerPerson,
      maxDriveMinutes: input.maxDriveMinutes,
    });

    // 4. Determinar se cada listing é demo
    //    Um resultado é demo quando vem do gerador fallback (raw_data.source === 'fallback-demo')
    //    OU quando o platformStatus da sua plataforma é 'demo'.
    const demoPlatforms = new Set(
      platformStatus
        .filter((p) => p.status === "demo")
        .map((p) => p.platform)
    );

    const isListingDemo = (l: ScrapedListing): boolean =>
      l.raw_data?.source === "fallback-demo" || demoPlatforms.has(l.platform);

    // A search inteira é demo quando NÃO existe nenhuma plataforma com status
    // 'ok' e count > 0 — ou seja, todos os dados provêm do gerador de demonstração.
    const hasRealResults = platformStatus.some(
      (p) => p.status === "ok" && p.count > 0
    );
    const searchIsDemo = !hasRealResults;

    // 5. Geocoding dos imóveis sem coordenadas, em paralelo com cache por endereço
    //    Listings do gerador demo já têm lat/lng sintéticos — o cache evita chamadas
    //    redundantes caso dois imóveis partilhem o mesmo endereço de texto.
    const geoCache = new Map<string, { lat: number; lng: number } | null>();

    async function resolveCoords(
      l: ScrapedListing
    ): Promise<{ lat: number | null; lng: number | null }> {
      // Se já tem coords válidas, usa-as directamente
      if (l.lat != null && l.lng != null) {
        return { lat: l.lat, lng: l.lng };
      }
      // Sem endereço, sem coords
      if (!l.address) return { lat: null, lng: null };

      const cacheKey = l.address.trim().toLowerCase();
      if (geoCache.has(cacheKey)) {
        return geoCache.get(cacheKey) ?? { lat: null, lng: null };
      }

      const result = await geocode(l.address);
      const coords = result ? { lat: result.lat, lng: result.lng } : null;
      geoCache.set(cacheKey, coords);
      return coords ?? { lat: null, lng: null };
    }

    const resolvedCoords = await Promise.all(listings.map(resolveCoords));

    // 6. Calcular drive_minutes para cada listing (com coords agora preenchidas)
    let enriched: (ScrapedListing & {
      drive_minutes: number | null;
      resolved_lat: number | null;
      resolved_lng: number | null;
    })[];

    if (obraLat != null && obraLng != null) {
      enriched = await Promise.all(
        listings.map(async (l, i) => {
          const { lat, lng } = resolvedCoords[i];
          const mins =
            lat != null && lng != null
              ? await driveMinutes(
                  { lat: obraLat, lng: obraLng },
                  { lat, lng }
                )
              : null;
          return { ...l, drive_minutes: mins, resolved_lat: lat, resolved_lng: lng };
        })
      );
    } else {
      enriched = listings.map((l, i) => ({
        ...l,
        drive_minutes: null,
        resolved_lat: resolvedCoords[i].lat,
        resolved_lng: resolvedCoords[i].lng,
      }));
    }

    // 7. Persistir resultados com flag is_demo por linha
    if (enriched.length) {
      const rows = enriched.map((l) => ({
        search_id: search.id,
        platform: l.platform,
        external_url: l.external_url,
        title: l.title,
        address: l.address,
        // usa coords resolvidas (geocode de fallback) se as originais eram null
        lat: l.resolved_lat,
        lng: l.resolved_lng,
        total_price: l.total_price,
        num_beds: l.num_beds,
        drive_minutes: l.drive_minutes,
        furnished: l.furnished,
        images: l.images,
        raw_data: l.raw_data,
        status: "new" as const,
        is_demo: isListingDemo(l),
      }));
      const { error: resErr } = await supabase.from("search_results").insert(rows);
      if (resErr) return { error: resErr.message };
    }

    // 8. Actualizar a search com is_demo final
    if (searchIsDemo) {
      await supabase
        .from("searches")
        .update({ is_demo: true })
        .eq("id", search.id);
    }

    revalidatePath("/dashboard");
    revalidatePath(`/search/${search.id}/results`);

    return {
      searchId: search.id,
      platformStatus: platformStatus.map((p) => ({
        platform: p.platform,
        status: p.status,
        count: p.count,
      })),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erro inesperado na busca.",
    };
  }
}
