"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ContactRating } from "@/types";

export async function addContact(formData: FormData) {
  await requireAdmin();

  const name = formData.get("name") as string;
  const company = (formData.get("company") as string) || null;
  const phone = (formData.get("phone") as string) || null;
  const email = (formData.get("email") as string) || null;
  const city = (formData.get("city") as string) || null;
  const rating = (formData.get("rating") as ContactRating) || "neutral";
  const notes = (formData.get("notes") as string) || null;

  if (!name?.trim()) return { error: "Nome é obrigatório." };

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").insert({
    name: name.trim(),
    company: company?.trim() || null,
    phone: phone?.trim() || null,
    email: email?.trim() || null,
    city: city?.trim() || null,
    rating,
    notes: notes?.trim() || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/history");
  revalidatePath("/contacts");
}

export async function updateContactRating({
  id,
  rating,
}: {
  id: string;
  rating: ContactRating;
}) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ rating, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/history");
  revalidatePath("/contacts");
}

export async function deleteContact({ id }: { id: string }) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/history");
  revalidatePath("/contacts");
}
