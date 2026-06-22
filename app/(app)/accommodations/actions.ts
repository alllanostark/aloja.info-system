"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { geocode } from "@/lib/maps";
import type { AccommodationStatus } from "@/types";

function revalidate() {
  revalidatePath("/accommodations");
  revalidatePath("/dashboard");
}

export async function createAccommodationFromResult({
  resultId,
}: {
  resultId: string;
}): Promise<{ error: string | null }> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: result, error: fetchError } = await supabase
    .from("search_results")
    .select("id, search_id, address, lat, lng, num_beds, total_price, furnished, external_url")
    .eq("id", resultId)
    .single();

  if (fetchError || !result) {
    return { error: fetchError?.message ?? "Resultado não encontrado." };
  }

  const address = result.address ?? "";

  // Verificar duplicado: mesmo search_id + endereço
  if (result.search_id && address) {
    const { data: existing } = await supabase
      .from("active_accommodations")
      .select("id")
      .eq("search_id", result.search_id)
      .eq("address", address)
      .maybeSingle();

    if (existing) {
      return { error: "Este imóvel já foi registado como alojamento ativo." };
    }
  }

  // Geocodar se não houver coords (degradação graciosa)
  let lat = result.lat as number | null;
  let lng = result.lng as number | null;
  let resolvedAddress = address;

  if (!lat || !lng) {
    const geo = await geocode(address);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
      resolvedAddress = geo.formattedAddress;
    }
  }

  const notes = result.external_url ? `Anúncio: ${result.external_url}` : null;

  const { error: insertError } = await supabase
    .from("active_accommodations")
    .insert({
      address: resolvedAddress || address,
      lat,
      lng,
      total_beds: (result.num_beds as number | null) ?? 1,
      monthly_rent: (result.total_price as number | null) ?? null,
      furnished: (result.furnished as boolean | null) ?? true,
      search_id: (result.search_id as string | null) ?? null,
      notes,
    });

  if (insertError) return { error: insertError.message };

  revalidate();
  return { error: null };
}

export async function addAccommodation(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const totalBeds = parseInt(formData.get("total_beds") as string, 10);
  const monthlyRent = formData.get("monthly_rent")
    ? parseFloat(formData.get("monthly_rent") as string)
    : null;

  const rawStatus = formData.get("status") as string | null;
  const status: AccommodationStatus =
    rawStatus === "inactive" || rawStatus === "external" ? rawStatus : "active";

  const honorarium = parseFloat(formData.get("honorarium") as string) || 0;
  const deposit = parseFloat(formData.get("deposit") as string) || 0;

  // Contacto: prioriza criar novo se new_contact_name vier preenchido
  let contact_id: string | null = null;
  const newContactName = (formData.get("new_contact_name") as string)?.trim();
  if (newContactName) {
    const newContactPhone = (formData.get("new_contact_phone") as string)?.trim() || null;
    const { data: newContact, error: contactError } = await supabase
      .from("contacts")
      .insert({ name: newContactName, phone: newContactPhone, rating: "neutral" })
      .select("id")
      .single();
    if (contactError) return { error: contactError.message };
    contact_id = newContact.id as string;
  } else {
    const rawContactId = (formData.get("contact_id") as string)?.trim();
    contact_id = rawContactId || null;
  }

  const address = (formData.get("address") as string) ?? "";
  const geo = await geocode(address);

  const { error } = await supabase.from("active_accommodations").insert({
    address: geo?.formattedAddress ?? address,
    city: (formData.get("city") as string) || null,
    total_beds: isNaN(totalBeds) ? 1 : totalBeds,
    monthly_rent: monthlyRent,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    obra_name: (formData.get("obra_name") as string) || null,
    contract_start: (formData.get("contract_start") as string) || null,
    contract_end: (formData.get("contract_end") as string) || null,
    owner_name: (formData.get("owner_name") as string) || null,
    owner_phone: (formData.get("owner_phone") as string) || null,
    notes: (formData.get("notes") as string) || null,
    furnished: formData.get("furnished") === "true",
    status,
    honorarium,
    deposit,
    contact_id,
  });

  if (error) return { error: error.message };
  revalidate();
  return { error: null };
}

export async function updateAccommodationStatus({
  id,
  status,
}: {
  id: string;
  status: AccommodationStatus;
}): Promise<{ error: string | null }> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("active_accommodations")
    .update({ status })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidate();
  return { error: null };
}

export async function assignBed({
  accommodationId,
  bedNumber,
  workerName,
  entryDate,
}: {
  accommodationId: string;
  bedNumber: number;
  workerName: string;
  entryDate: string;
}) {
  await requireAdmin();
  const supabase = await createClient();

  // Pre-flight: verificar se já existe ocupante ativo nesta cama.
  const { data: existing, error: checkError } = await supabase
    .from("bed_occupants")
    .select("id")
    .eq("accommodation_id", accommodationId)
    .eq("bed_number", bedNumber)
    .is("exit_date", null)
    .limit(1)
    .maybeSingle();

  if (checkError) return { error: checkError.message };
  if (existing) return { error: "Cama já ocupada." };

  const { error } = await supabase.from("bed_occupants").insert({
    accommodation_id: accommodationId,
    bed_number: bedNumber,
    worker_name: workerName,
    entry_date: entryDate,
    exit_date: null,
  });

  if (error) {
    // Captura violação de índice único (race condition entre pre-flight e insert).
    if (error.code === "23505") return { error: "Cama já ocupada." };
    return { error: error.message };
  }
  revalidate();
  return { error: null };
}

export async function markBedExit({ occupantId }: { occupantId: string }) {
  await requireAdmin();
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase
    .from("bed_occupants")
    .update({ exit_date: today })
    .eq("id", occupantId);

  if (error) return { error: error.message };
  revalidate();
  return { error: null };
}

export async function removeAccommodation({ id }: { id: string }) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("active_accommodations")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidate();
  return { error: null };
}

export async function updateAccommodation({
  id,
  address,
  city,
  total_beds,
  monthly_rent,
  obra_name,
  contract_start,
  contract_end,
  owner_name,
  owner_phone,
  notes,
}: {
  id: string;
  address: string;
  city: string | null;
  total_beds: number;
  monthly_rent: number | null;
  obra_name: string | null;
  contract_start: string | null;
  contract_end: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  notes: string | null;
}) {
  await requireAdmin();
  const supabase = await createClient();

  // Não basta contar ocupados: a POSIÇÃO importa. Se houver ocupante na cama 4
  // e reduzires para 1, o trabalhador fica órfão (o grid só mostra 1..total).
  // Validar pelo MAIOR bed_number ocupado.
  const { data: occRows, error: occError } = await supabase
    .from("bed_occupants")
    .select("bed_number")
    .eq("accommodation_id", id)
    .is("exit_date", null)
    .order("bed_number", { ascending: false })
    .limit(1);

  if (occError) return { error: occError.message };

  const maxOccupiedBed = occRows?.[0]?.bed_number ?? 0;
  if (total_beds < maxOccupiedBed) {
    return {
      error: `Há um ocupante na cama ${maxOccupiedBed}. Liberta-a antes de reduzir para ${total_beds} ${total_beds === 1 ? "cama" : "camas"}.`,
    };
  }

  // Re-geocodar para manter lat/lng coerentes com o endereço (e popular as que
  // estavam vazias). Só sobrescreve coords se o geocode resultar.
  const geo = await geocode(address);

  const updatePayload: Record<string, unknown> = {
    address: geo?.formattedAddress ?? address,
    city: city || null,
    total_beds,
    monthly_rent,
    obra_name: obra_name || null,
    contract_start: contract_start || null,
    contract_end: contract_end || null,
    owner_name: owner_name || null,
    owner_phone: owner_phone || null,
    notes: notes || null,
  };
  if (geo) {
    updatePayload.lat = geo.lat;
    updatePayload.lng = geo.lng;
  }

  const { error } = await supabase
    .from("active_accommodations")
    .update(updatePayload)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidate();
  return { error: null };
}
