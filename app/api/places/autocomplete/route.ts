import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface PlacesPrediction {
  description: string;
  place_id: string;
}

interface GooglePlacesResponse {
  status: string;
  predictions?: Array<{
    description: string;
    place_id: string;
  }>;
}

// Rate limiting in-memory (instância única no VPS via PM2). Janela deslizante:
// 60 pedidos/min por utilizador — protege a quota faturável da Google mesmo
// que uma sessão autenticada abuse (debounce do cliente pode gerar ~200/min).
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const rateHits = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (rateHits.get(userId) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
  if (recent.length >= RATE_LIMIT) {
    rateHits.set(userId, recent);
    return true;
  }
  recent.push(now);
  rateHits.set(userId, recent);
  return false;
}

export async function GET(req: NextRequest) {
  // Rota fora do grupo (app) → o auth do layout não a cobre. Esta rota gasta
  // quota faturável da Google, por isso exige sessão autenticada.
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { predictions: [] },
      { status: 401, headers: noStore() }
    );
  }

  if (isRateLimited(profile.id)) {
    return NextResponse.json(
      { predictions: [] },
      { status: 429, headers: noStore() }
    );
  }

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const session = searchParams.get("session") ?? "";

  if (!q || q.length < 2) {
    return NextResponse.json({ predictions: [] }, { headers: noStore() });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY ?? "";
  if (!key) {
    return NextResponse.json({ predictions: [] }, { headers: noStore() });
  }

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/autocomplete/json"
  );
  url.searchParams.set("input", q);
  url.searchParams.set("key", key);
  url.searchParams.set("language", "pt");
  url.searchParams.set("components", "country:es");
  if (session) url.searchParams.set("sessiontoken", session);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ predictions: [] }, { headers: noStore() });
    }

    const data: GooglePlacesResponse = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return NextResponse.json({ predictions: [] }, { headers: noStore() });
    }

    const predictions: PlacesPrediction[] = (data.predictions ?? []).map(
      (p) => ({
        description: p.description,
        place_id: p.place_id,
      })
    );

    return NextResponse.json({ predictions }, { headers: noStore() });
  } catch {
    return NextResponse.json({ predictions: [] }, { headers: noStore() });
  }
}

function noStore(): HeadersInit {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
  };
}
