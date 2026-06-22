"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Car, BedDouble, ExternalLink, AlertCircle } from "lucide-react";
import { cn, formatEuro } from "@/lib/utils";
import type { Search, SearchResult } from "@/types";

// ── Tipos mínimos da Google Maps JS API (sem @types/google.maps) ──────────────

interface GLatLng {
  lat: number;
  lng: number;
}

interface GBounds {
  extend(point: GLatLng): void;
  isEmpty(): boolean;
}

interface GInfoWindow {
  setContent(html: string): void;
  open(opts: { anchor: GMarker; map: GMap }): void;
  close(): void;
}

interface GMarker {
  map: GMap | null;
  addListener(event: string, handler: () => void): { remove(): void };
}

interface GMap {
  fitBounds(bounds: GBounds, padding: Record<string, number>): void;
  getZoom(): number | undefined;
  setZoom(zoom: number): void;
  addListener(event: string, handler: () => void): { remove(): void };
}

interface GMapsEvent {
  removeListener(listener: { remove(): void }): void;
}

interface GMapsMarkerLib {
  AdvancedMarkerElement: new (opts: {
    position: GLatLng;
    map: GMap;
    content?: HTMLElement;
    title?: string;
    zIndex?: number;
  }) => GMarker;
}

interface GMaps {
  Map: new (
    container: HTMLElement,
    opts: Record<string, unknown>
  ) => GMap;
  InfoWindow: new (opts: Record<string, unknown>) => GInfoWindow;
  LatLngBounds: new () => GBounds;
  event: GMapsEvent;
  marker: GMapsMarkerLib;
}

type MapsCallback = { resolve: () => void; reject: (e: Error) => void };

type GoogleWindow = Window & {
  __sparksMapLoaded?: boolean;
  __sparksMapCallbacks?: MapsCallback[];
  google?: { maps: GMaps };
};

// ── Loader idempotente da Google Maps JS API ──────────────────────────────────

function loadMapsApi(apiKey: string): Promise<void> {
  const gw = window as GoogleWindow;
  return new Promise((resolve, reject) => {
    if (gw.__sparksMapLoaded) { resolve(); return; }
    if (gw.__sparksMapCallbacks) {
      gw.__sparksMapCallbacks.push({ resolve, reject });
      return;
    }
    gw.__sparksMapCallbacks = [{ resolve, reject }];

    const callbackName = "__sparksMapReady";
    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      gw.__sparksMapLoaded = true;
      gw.__sparksMapCallbacks?.forEach((cb) => cb.resolve());
      gw.__sparksMapCallbacks = [];
    };

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${apiKey}` +
      `&libraries=marker&callback=${callbackName}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      const err = new Error("Falha ao carregar a Google Maps API");
      // Rejeita TODOS os que esperavam (não só o 1.º) e limpa o estado global
      // para permitir um retry limpo num próximo mount.
      gw.__sparksMapCallbacks?.forEach((cb) => cb.reject(err));
      gw.__sparksMapCallbacks = undefined;
      delete (window as unknown as Record<string, unknown>)[callbackName];
      script.remove();
    };
    document.head.appendChild(script);
  });
}

// ── Construtores de pinos HTML ────────────────────────────────────────────────

function buildObraPin(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "display:flex;flex-direction:column;align-items:center;cursor:default;";

  const pin = document.createElement("div");
  pin.style.cssText = `
    background:#f97316;border:2px solid rgba(255,255,255,0.25);
    border-radius:50%;width:28px;height:28px;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 0 4px rgba(249,115,22,0.25),0 2px 8px rgba(0,0,0,0.6);
  `;
  pin.innerHTML =
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>`;

  const label = document.createElement("span");
  label.textContent = "Obra";
  label.style.cssText = `
    margin-top:3px;font-size:10px;font-weight:600;color:#f97316;
    text-shadow:0 1px 3px rgba(0,0,0,0.9);white-space:nowrap;
    font-family:system-ui,-apple-system,sans-serif;
  `;

  wrapper.appendChild(pin);
  wrapper.appendChild(label);
  return wrapper;
}

function buildPropertyPin(label: string, withinBudget: boolean): HTMLElement {
  const color = withinBudget ? "#4ade80" : "#f87171";
  const glow = withinBudget ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)";

  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "display:flex;flex-direction:column;align-items:center;cursor:pointer;";

  const pill = document.createElement("div");
  pill.style.cssText = `
    background:#111318;border:1.5px solid ${color};border-radius:9999px;
    padding:3px 8px;font-size:11px;font-weight:600;color:${color};
    white-space:nowrap;font-variant-numeric:tabular-nums;
    box-shadow:0 0 0 3px ${glow},0 2px 8px rgba(0,0,0,0.7);
    font-family:system-ui,-apple-system,sans-serif;
  `;
  pill.textContent = label;

  const caret = document.createElement("div");
  caret.style.cssText = `
    width:0;height:0;
    border-left:5px solid transparent;border-right:5px solid transparent;
    border-top:6px solid ${color};margin-top:-1px;
  `;

  wrapper.appendChild(pill);
  wrapper.appendChild(caret);
  return wrapper;
}

// ── Sanitização (dados vêm de scraping → não confiáveis) ──────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Só aceita http/https. Bloqueia javascript:, data:, etc. */
function safeUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:"
      ? escapeHtml(url)
      : null;
  } catch {
    return null;
  }
}

// ── Conteúdo HTML do InfoWindow ───────────────────────────────────────────────

function buildInfoWindowHtml(result: SearchResult, budget: number): string {
  const overBudget =
    result.cost_per_person != null && result.cost_per_person > budget;
  const costColor = overBudget ? "#f87171" : "#4ade80";

  const fmt = (v: number | null | undefined) =>
    v != null
      ? new Intl.NumberFormat("pt-PT", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }).format(v)
      : "—";

  const title = escapeHtml(result.title ?? result.address ?? "Imovel");
  const addr = escapeHtml(result.address ?? "");
  const drive =
    result.drive_minutes != null ? `${result.drive_minutes} min` : "—";
  const beds = result.num_beds != null ? `${result.num_beds}` : "—";

  const externalUrl = safeUrl(result.external_url);
  const externalBtn = externalUrl
    ? `<a href="${externalUrl}" target="_blank" rel="noopener noreferrer"
        style="display:inline-flex;align-items:center;gap:4px;margin-top:8px;
          font-size:11px;font-weight:600;color:#fb923c;text-decoration:none;
          padding:4px 8px;border-radius:6px;border:1px solid rgba(249,115,22,0.25);
          background:rgba(249,115,22,0.08);">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>Ver anuncio
      </a>`
    : "";

  return `
    <div style="background:#111318;border:1px solid rgba(255,255,255,0.1);
      border-radius:10px;padding:12px 14px;min-width:200px;max-width:240px;
      font-family:system-ui,-apple-system,sans-serif;color:#f4f4f6;
      box-shadow:0 8px 32px rgba(0,0,0,0.7);">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#f4f4f6;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:212px;"
        title="${title}">${title}</p>
      ${addr ? `<p style="margin:0 0 8px;font-size:10px;color:#62666d;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:212px;"
        title="${addr}">${addr}</p>` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;
        border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;">
        <div>
          <div style="font-size:13px;font-weight:700;color:${costColor};
            font-variant-numeric:tabular-nums;">${fmt(result.cost_per_person)}</div>
          <div style="font-size:9px;color:#62666d;margin-top:1px;">por pessoa</div>
        </div>
        <div>
          <div style="font-size:13px;font-weight:600;color:#f4f4f6;
            font-variant-numeric:tabular-nums;">${drive}</div>
          <div style="font-size:9px;color:#62666d;margin-top:1px;">conducao</div>
        </div>
        <div>
          <div style="font-size:13px;font-weight:600;color:#f4f4f6;">${beds}</div>
          <div style="font-size:9px;color:#62666d;margin-top:1px;">camas</div>
        </div>
      </div>
      ${externalBtn}
    </div>
  `;
}

// ── Tipos de estado ───────────────────────────────────────────────────────────

type MapState = "idle" | "loading" | "ready" | "error";

// ── Componente principal ──────────────────────────────────────────────────────

export function PropertyMap({
  search,
  results,
}: {
  search: Search;
  results: SearchResult[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GMap | null>(null);
  const markersRef = useRef<GMarker[]>([]);
  const infoWindowRef = useRef<GInfoWindow | null>(null);
  const idleListenerRef = useRef<{ remove(): void } | null>(null);

  const [mapState, setMapState] = useState<MapState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const withCoords = results.filter(
    (r): r is SearchResult & { lat: number; lng: number } =>
      r.lat != null && r.lng != null
  );
  const withoutCoords = results.length - withCoords.length;

  const hasObraCoords =
    search.obra_lat != null && search.obra_lng != null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!containerRef.current) return;

    if (!apiKey) {
      setMapState("error");
      setErrorMsg(
        "Chave da Google Maps API nao configurada (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)."
      );
      return;
    }
    if (!hasObraCoords) {
      setMapState("error");
      setErrorMsg(
        "A obra nao tem coordenadas. Execute a busca novamente para geocodificar o endereco."
      );
      return;
    }

    setMapState("loading");

    let cancelled = false;

    loadMapsApi(apiKey)
      .then(() => {
        if (!cancelled) initMap();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setMapState("error");
        setErrorMsg(
          err instanceof Error ? err.message : "Erro ao carregar o mapa."
        );
      });

    return () => {
      cancelled = true;
      idleListenerRef.current?.remove();
      idleListenerRef.current = null;
      markersRef.current.forEach((m) => { m.map = null; });
      markersRef.current = [];
      infoWindowRef.current?.close();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function initMap() {
    if (mapRef.current) return; // já inicializado (re-entrada em StrictMode)
    const container = containerRef.current;
    if (!container) return;

    const gw = window as GoogleWindow;
    const gmaps = gw.google?.maps;
    if (!gmaps) return;

    const obraLat = search.obra_lat!;
    const obraLng = search.obra_lng!;

    const map = new gmaps.Map(container, {
      center: { lat: obraLat, lng: obraLng },
      zoom: 12,
      // Map ID próprio via env (Google Cloud > Map IDs). Fallback DEMO_MAP_ID
      // faz os Advanced Markers funcionarem out-of-the-box sem config manual.
      mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
      backgroundColor: "#07080a",
      gestureHandling: "cooperative",
    });

    mapRef.current = map;

    const infoWindow = new gmaps.InfoWindow({ disableAutoPan: false });
    infoWindowRef.current = infoWindow;

    // Marcador da obra
    const obraMarker = new gmaps.marker.AdvancedMarkerElement({
      position: { lat: obraLat, lng: obraLng },
      map,
      content: buildObraPin(),
      title: search.obra_address,
      zIndex: 1000,
    });
    markersRef.current.push(obraMarker);

    const bounds = new gmaps.LatLngBounds();
    bounds.extend({ lat: obraLat, lng: obraLng });

    // Marcadores dos imoveis
    withCoords.forEach((result) => {
      const { lat, lng } = result;
      const withinBudget =
        result.cost_per_person != null &&
        result.cost_per_person <= search.budget_per_person;

      const labelText =
        result.cost_per_person != null
          ? new Intl.NumberFormat("pt-PT", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            }).format(result.cost_per_person)
          : "—";

      const marker = new gmaps.marker.AdvancedMarkerElement({
        position: { lat, lng },
        map,
        content: buildPropertyPin(labelText, withinBudget),
        title: result.title ?? result.address ?? undefined,
        zIndex: withinBudget ? 100 : 50,
      });

      marker.addListener("click", () => {
        infoWindow.setContent(
          buildInfoWindowHtml(result, search.budget_per_person)
        );
        infoWindow.open({ anchor: marker, map });
      });

      markersRef.current.push(marker);
      bounds.extend({ lat, lng });
    });

    // Enquadra todos os pinos, com zoom maximo 15
    if (!bounds.isEmpty() && withCoords.length > 0) {
      map.fitBounds(bounds, { top: 48, right: 32, bottom: 32, left: 32 });
      const listener = map.addListener("idle", () => {
        const z = map.getZoom();
        if (z != null && z > 15) map.setZoom(15);
        gmaps.event.removeListener(listener);
        idleListenerRef.current = null;
      });
      idleListenerRef.current = listener;
    }

    setMapState("ready");
  }

  return (
    <div className="space-y-3">
      {/* Mapa */}
      <div
        className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-medium)] bg-surface-2"
        style={{ height: 420 }}
      >
        <div ref={containerRef} className="h-full w-full" />

        {/* Skeleton de loading */}
        {mapState === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 shimmer">
            <MapPin
              size={24}
              strokeWidth={1.5}
              className="animate-pulse text-orange-400"
            />
            <span className="text-xs text-ink-subtle">A carregar o mapa...</span>
          </div>
        )}

        {/* Erro */}
        {mapState === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <AlertCircle size={24} strokeWidth={1.5} className="text-red-400" />
            <p className="text-sm text-ink-muted">{errorMsg}</p>
          </div>
        )}

        {/* Legenda flutuante */}
        {mapState === "ready" && (
          <div
            className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--hairline-medium)] px-3 py-2 text-[11px]"
            style={{ background: "var(--glass-bg)", backdropFilter: "blur(8px)" }}
          >
            <LegendDot color="#f97316" label="Obra" circle />
            <LegendDot color="#4ade80" label="Dentro do orcamento" />
            <LegendDot color="#f87171" label="Acima do orcamento" />
          </div>
        )}
      </div>

      {/* Nota: imoveis sem coordenadas */}
      {withoutCoords > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
          <AlertCircle size={12} strokeWidth={1.5} className="shrink-0" />
          {withoutCoords === 1
            ? "1 imovel sem localizacao nao aparece no mapa."
            : `${withoutCoords} imoveis sem localizacao nao aparecem no mapa.`}
        </p>
      )}

      {/* Grid sumario abaixo do mapa */}
      {mapState === "ready" && withCoords.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {withCoords.map((r) => (
            <MapResultRow key={r.id} result={r} budget={search.budget_per_person} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function LegendDot({
  color,
  label,
  circle = false,
}: {
  color: string;
  label: string;
  circle?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5 text-ink-muted">
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: circle ? 10 : 28,
          height: 10,
          borderRadius: circle ? "50%" : 9999,
          background: color,
          border: "1.5px solid rgba(255,255,255,0.2)",
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

function MapResultRow({
  result,
  budget,
}: {
  result: SearchResult;
  budget: number;
}) {
  const withinBudget =
    result.cost_per_person != null && result.cost_per_person <= budget;
  const overBudget =
    result.cost_per_person != null && result.cost_per_person > budget;

  return (
    <div
      className="flex items-center justify-between rounded-[var(--radius-md)] border bg-surface-2 px-3 py-2.5 text-xs"
      style={{
        borderColor: withinBudget
          ? "var(--green-border)"
          : overBudget
            ? "var(--red-border)"
            : "var(--hairline)",
      }}
    >
      <span className="truncate pr-2 text-ink-muted">
        {result.title ?? result.address ?? "—"}
      </span>
      <div className="flex shrink-0 items-center gap-3">
        {result.drive_minutes != null && (
          <span className="flex items-center gap-1 text-ink-subtle">
            <Car size={11} strokeWidth={1.5} />
            {result.drive_minutes} min
          </span>
        )}
        {result.num_beds != null && (
          <span className="flex items-center gap-1 text-ink-subtle">
            <BedDouble size={11} strokeWidth={1.5} />
            {result.num_beds}
          </span>
        )}
        <span
          className={cn(
            "tabular font-medium",
            withinBudget ? "text-green-400" : overBudget ? "text-red-400" : "text-ink"
          )}
        >
          {formatEuro(result.cost_per_person)}
        </span>
        {result.external_url && (
          <a
            href={result.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 transition-colors hover:text-orange-300"
            aria-label="Ver anuncio"
          >
            <ExternalLink size={12} strokeWidth={1.5} />
          </a>
        )}
      </div>
    </div>
  );
}
