// ════════════════════════════════════════════════════════════
// Tipos de domínio — Sparks Aloja
// Espelham o schema Supabase (public.*)
// ════════════════════════════════════════════════════════════

export type UserRole = "admin" | "viewer";
export type SearchStatus = "active" | "completed" | "abandoned";
export type ResultStatus = "new" | "saved" | "discarded";
export type PropertyPlatform =
  | "idealista"
  | "fotocasa"
  | "habitaclia"
  | "homyspace"
  | "milanuncios"
  | "airbnb"
  | "vivara"
  | "spotahome"
  | "uniplaces"
  | "pisos"
  | "yaencontre";
export type DiscardReason =
  | "price"
  | "distance"
  | "owner"
  | "condition"
  | "other";
export type ContactRating = "good" | "neutral" | "bad";
export type AccommodationStatus = "active" | "inactive" | "external";
export type CombinationSourceType =
  | "search"
  | "active"
  | "external"
  | "discarded"
  | "manual";

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Search {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  obra_name: string | null;
  obra_address: string;
  obra_lat: number | null;
  obra_lng: number | null;
  num_workers: number;
  duration_weeks: number | null;
  budget_per_person: number;
  max_drive_minutes: number;
  status: SearchStatus;
  is_demo: boolean;
}

export interface SearchResult {
  id: string;
  created_at: string;
  search_id: string;
  platform: PropertyPlatform;
  external_url: string | null;
  title: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  total_price: number | null;
  num_beds: number | null;
  cost_per_person: number | null; // generated
  drive_minutes: number | null;
  furnished: boolean | null;
  images: string[];
  raw_data: Record<string, unknown> | null;
  status: ResultStatus;
  is_demo: boolean;
  honorarium: number; // onda 5 — default 0
  deposit: number;    // onda 5 — default 0
}

export interface SearchCombination {
  id: string;
  created_at: string;
  search_id: string;
  result_ids: string[];
  total_price: number;
  total_beds: number;
  cost_per_person: number | null; // generated
  label: string | null;
}

export interface ActiveAccommodation {
  id: string;
  created_at: string;
  updated_at: string;
  address: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  total_beds: number;
  monthly_rent: number | null;
  furnished: boolean;
  obra_name: string | null;
  search_id: string | null;
  contract_start: string | null;
  contract_end: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  notes: string | null;
  status: AccommodationStatus;  // onda 5
  contact_id: string | null;    // onda 5
  honorarium: number;           // onda 5
  deposit: number;              // onda 5
}

export interface BedOccupant {
  id: string;
  created_at: string;
  accommodation_id: string;
  bed_number: number;
  worker_name: string | null;
  entry_date: string | null;
  exit_date: string | null;
}

export interface Contact {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  rating: ContactRating;
  notes: string | null;
  last_used: string | null;
}

export interface AccommodationOccupancy {
  id: string;
  address: string;
  city: string | null;
  obra_name: string | null;
  total_beds: number;
  occupied: number;
  vacant: number;
}

// ─── Onda 5: composições editáveis ───────────────────────────────────────────

export interface CombinationOverride {
  id: string;
  created_at: string;
  updated_at: string;
  search_id: string;
  label: string;
  duration_value: number;
  duration_unit: "months" | "weeks" | "days";
  notes: string | null;
}

export interface CombinationItem {
  id: string;
  created_at: string;
  combination_id: string;
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

// Metadados das plataformas (badge cores / labels)
export const PLATFORM_META: Record<
  PropertyPlatform,
  { label: string; short: string }
> = {
  idealista: { label: "Idealista", short: "ID" },
  fotocasa: { label: "Fotocasa", short: "FC" },
  habitaclia: { label: "Habitaclia", short: "HB" },
  homyspace: { label: "Homyspace", short: "HS" },
  milanuncios: { label: "Milanuncios", short: "MA" },
  airbnb: { label: "Airbnb", short: "AB" },
  vivara: { label: "Vivara", short: "VV" },
  spotahome: { label: "Spotahome", short: "SP" },
  uniplaces: { label: "Uniplaces", short: "UP" },
  pisos: { label: "pisos.com", short: "PS" },
  yaencontre: { label: "Yaencontre", short: "YE" },
};
