// ════════════════════════════════════════════════════════════
// Buscador de agências imobiliárias (Apify · Google Places)
//
// Usa o ator compass/crawler-google-places para encontrar agências
// imobiliárias perto de uma localização e alimentar a base de Contactos.
// (Este ator devolve negócios do Google Maps — nome, telefone, rating —
//  NÃO anúncios de aluguer. Para apartamentos ver lib/apify.ts.)
// ════════════════════════════════════════════════════════════

import type { ContactRating } from "@/types";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN ?? "";
const AGENCY_ACTOR =
  process.env.APIFY_ACTOR_AGENCIES ?? "compass~crawler-google-places";

export interface FoundAgency {
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  rating: ContactRating;
  notes: string | null;
}

function scoreToRating(score: unknown): ContactRating {
  const n = typeof score === "number" ? score : null;
  if (n == null) return "neutral";
  if (n >= 4.3) return "good";
  if (n >= 3.5) return "neutral";
  return "bad";
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Procura agências imobiliárias perto de `location` (cidade ou morada). */
export async function findAgencies(location: string): Promise<FoundAgency[]> {
  if (!APIFY_TOKEN || !location.trim()) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${AGENCY_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchStringsArray: ["agencia inmobiliaria alquiler de pisos"],
          locationQuery: location,
          maxCrawledPlacesPerSearch: 12,
          language: "es",
        }),
        signal: controller.signal,
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error(`Apify HTTP ${res.status}`);
    const items: unknown[] = await res.json();

    return items
      .filter((i): i is Record<string, unknown> => typeof i === "object" && i != null)
      .map((i) => {
        const phone = str(i.phoneUnformatted) ?? str(i.phone);
        const address = str(i.address);
        const score = i.totalScore;
        return {
          name: str(i.title) ?? "Agência",
          company: str(i.categoryName) ?? "Agência imobiliária",
          phone,
          email: str(i.website),
          city: str(i.city),
          rating: scoreToRating(score),
          notes: [
            address,
            typeof score === "number" ? `Avaliação Google: ${score}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || null,
        } satisfies FoundAgency;
      })
      .filter((a) => a.name && a.name !== "Agência");
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
