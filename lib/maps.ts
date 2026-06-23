// ════════════════════════════════════════════════════════════
// Google Maps — geocoding de endereços + tempo de condução
// Server-side apenas (usa GOOGLE_MAPS_API_KEY, nunca a expor).
// Degradação graciosa: qualquer falha devolve null em vez de lançar.
// ════════════════════════════════════════════════════════════

const KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeocodeResult extends GeoPoint {
  formattedAddress: string;
  /** Cidade/município (locality) — usada como termo de busca nos atores. */
  city: string | null;
  /** Província (administrative_area_level_2, ex: "Girona"). Termo de busca
   *  robusto: existe nas plataformas mesmo quando a vila não existe lá. */
  province: string | null;
  /** País (ex: "España") — salvaguarda contra resultados fora do país. */
  country: string | null;
}

/** Converte um endereço em coordenadas (Geocoding API). */
export async function geocode(
  address: string
): Promise<GeocodeResult | null> {
  if (!KEY || !address.trim()) return null;
  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?` +
      `address=${encodeURIComponent(address)}&region=es&language=pt&key=${KEY}`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) return null;
    const r = data.results[0];
    const comps: Array<{ long_name: string; types: string[] }> =
      r.address_components ?? [];
    const pick = (t: string) =>
      comps.find((c) => c.types.includes(t))?.long_name ?? null;
    // locality = cidade; fallbacks para vilas e nível administrativo (município).
    const city =
      pick("locality") ??
      pick("postal_town") ??
      pick("administrative_area_level_2") ??
      null;
    const province = pick("administrative_area_level_2");
    const country = pick("country");
    return {
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      formattedAddress: r.formatted_address,
      city,
      province,
      country,
    };
  } catch {
    return null;
  }
}

/**
 * Distância em linha reta (km) entre dois pontos — fórmula de Haversine.
 * Sem custo de API. Salvaguarda barata contra resultados de outra região
 * quando o tempo de condução não pôde ser calculado.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Tempo de condução em minutos (com tráfego) entre dois pontos.
 * Usa a Routes API (computeRoutes). Devolve null se indisponível.
 */
export async function driveMinutes(
  origin: GeoPoint,
  destination: GeoPoint
): Promise<number | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": KEY,
          "X-Goog-FieldMask": "routes.duration",
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: { latitude: origin.lat, longitude: origin.lng },
            },
          },
          destination: {
            location: {
              latLng: {
                latitude: destination.lat,
                longitude: destination.lng,
              },
            },
          },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
        cache: "no-store",
      }
    );
    if (!res.ok) return await driveMinutesLegacy(origin, destination);
    const data = await res.json();
    const dur: string | undefined = data.routes?.[0]?.duration; // ex "1234s"
    if (!dur) return null;
    const seconds = parseInt(dur.replace("s", ""), 10);
    return Number.isFinite(seconds) ? Math.round(seconds / 60) : null;
  } catch {
    return await driveMinutesLegacy(origin, destination);
  }
}

/** Fallback para a Directions API legacy, caso a Routes API não esteja ativa. */
async function driveMinutesLegacy(
  origin: GeoPoint,
  destination: GeoPoint
): Promise<number | null> {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/directions/json?` +
      `origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}` +
      `&mode=driving&departure_time=now&key=${KEY}`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (data.status !== "OK") return null;
    const leg = data.routes?.[0]?.legs?.[0];
    const seconds = leg?.duration_in_traffic?.value ?? leg?.duration?.value;
    return seconds ? Math.round(seconds / 60) : null;
  } catch {
    return null;
  }
}

/** Enriquece uma lista de pontos com o tempo de condução até à obra, em paralelo. */
export async function enrichDriveTimes<T extends { lat: number | null; lng: number | null }>(
  obra: GeoPoint,
  items: T[]
): Promise<(T & { driveMinutes: number | null })[]> {
  return Promise.all(
    items.map(async (item) => {
      if (item.lat == null || item.lng == null) {
        return { ...item, driveMinutes: null };
      }
      const mins = await driveMinutes(obra, { lat: item.lat, lng: item.lng });
      return { ...item, driveMinutes: mins };
    })
  );
}
