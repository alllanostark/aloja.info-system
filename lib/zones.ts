// ════════════════════════════════════════════════════════════
// Zonas conhecidas — detecta se um resultado está perto de um
// alojamento ativo (ou histórico) da empresa.
// Pure functions: sem side effects, sem I/O.
// ════════════════════════════════════════════════════════════

import type { SearchResult } from "@/types";

interface GeoPoint {
  lat: number;
  lng: number;
}

/** Subconjunto de ActiveAccommodation necessário para a detecção de zona. */
export interface AccommodationGeoRef {
  id: string;
  address: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  obra_name: string | null;
}

/** Distância em km entre dois pontos usando a fórmula de Haversine. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export interface KnownZoneMatch {
  known: boolean;
  label?: string;
}

/**
 * Verifica se um resultado de busca está dentro do raio `thresholdKm`
 * de qualquer alojamento ativo que tenha coordenadas.
 *
 * Devolve { known: false } se não houver match.
 * Devolve { known: true, label } onde label identifica o alojamento mais
 * próximo — preferindo o nome da obra, caindo para a cidade ou endereço.
 */
export function matchKnownZone(
  result: SearchResult,
  accommodations: AccommodationGeoRef[],
  thresholdKm = 2
): KnownZoneMatch {
  if (result.lat == null || result.lng == null) return { known: false };

  const resultPoint: GeoPoint = { lat: result.lat, lng: result.lng };

  let closestKm = Infinity;
  let closestAcc: AccommodationGeoRef | null = null;

  for (const acc of accommodations) {
    if (acc.lat == null || acc.lng == null) continue;
    const km = haversineKm(resultPoint, { lat: acc.lat, lng: acc.lng });
    if (km < closestKm) {
      closestKm = km;
      closestAcc = acc;
    }
  }

  if (closestAcc == null || closestKm > thresholdKm) return { known: false };

  const label =
    closestAcc.obra_name != null
      ? `Perto de ${closestAcc.obra_name}`
      : closestAcc.city != null
        ? `Zona ${closestAcc.city}`
        : `Perto de ${closestAcc.address}`;

  return { known: true, label };
}
