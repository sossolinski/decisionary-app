import { supabase } from "./supabaseClient";

/* =========================
   SCENARIOS
========================= */

export type Scenario = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
};

export async function listScenarios(): Promise<Scenario[]> {
  const { data, error } = await supabase
    .from("scenarios")
    .select("id, title, description, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createScenario(title: string): Promise<Scenario> {
  const { data, error } = await supabase
    .from("scenarios")
    .insert({ title })
    .select("id, title, description, created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteScenario(id: string) {
  const { error } = await supabase
    .from("scenarios")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
