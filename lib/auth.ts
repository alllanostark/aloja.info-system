import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

/** Retorna o utilizador autenticado + o seu perfil (ou null). */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (profile as Profile) ?? null;
}

export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === "admin";
}

/**
 * Garante que o utilizador atual é admin (Ingrid). Lança erro se não for.
 * Usar no topo de Server Actions que mutam dados.
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sessão expirada. Faz login novamente.");
  if (profile.role !== "admin") {
    throw new Error("Apenas o administrador pode realizar esta ação.");
  }
  return profile;
}
