import { supabase } from "./supabaseClient";

export type UserRole = "admin" | "participant" | "facilitator";

export type Profile = {
  user_id: string;
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
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  // if the profile has not been created yet (race condition on fresh signup)
  // default to participant (MVP-safe)
  return (data?.role as UserRole) ?? "participant";
}
