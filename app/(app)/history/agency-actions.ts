"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { findAgencies } from "@/lib/agencies";
import type { Contact } from "@/types";

export interface ImportResult {
  found?: number;
  added?: number;
  error?: string;
}

/** Procura agências perto de `location` e adiciona as novas aos Contactos. */
export async function importAgenciesNearObra({
  location,
}: {
  location: string;
}): Promise<ImportResult> {
  try {
    await requireAdmin();
    if (!location.trim()) return { error: "Indica uma cidade ou morada." };

    const agencies = await findAgencies(location);
    if (agencies.length === 0) {
      return { found: 0, added: 0 };
    }

    const supabase = await createClient();

    // Dedup contra contactos existentes (por telefone normalizado ou nome)
    const { data: existing } = await supabase
      .from("contacts")
      .select("name, phone");
    const existingContacts = (existing ?? []) as Pick<Contact, "name" | "phone">[];
    const seenPhones = new Set(
      existingContacts
        .map((c) => c.phone?.replace(/\D/g, ""))
        .filter(Boolean)
    );
    const seenNames = new Set(
      existingContacts.map((c) => c.name.toLowerCase().trim())
    );

    const toInsert = agencies.filter((a) => {
      const phoneKey = a.phone?.replace(/\D/g, "");
      if (phoneKey && seenPhones.has(phoneKey)) return false;
      if (seenNames.has(a.name.toLowerCase().trim())) return false;
      return true;
    });

    if (toInsert.length === 0) {
      return { found: agencies.length, added: 0 };
    }

    const { error } = await supabase.from("contacts").insert(
      toInsert.map((a) => ({
        name: a.name,
        company: a.company,
        phone: a.phone,
        email: a.email,
        city: a.city,
        rating: a.rating,
        notes: a.notes,
        last_used: null,
      }))
    );

    if (error) return { error: error.message };

    revalidatePath("/history");
    return { found: agencies.length, added: toInsert.length };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erro ao importar agências.",
    };
  }
}
