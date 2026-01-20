import { supabase } from "./supabaseClient";

export type UserRole = "participant" | "facilitator";

export type Profile = {
  id: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export async function getMyRole(): Promise<UserRole | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  // jeśli profil jeszcze się nie utworzył (race condition na świeżym signup)
  // traktujemy jako participant (MVP-safe)
  return (data?.role as UserRole) ?? "participant";
}
