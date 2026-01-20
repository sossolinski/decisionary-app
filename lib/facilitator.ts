// lib/facilitator.ts
import { supabase } from "./supabaseClient";

/* =========================
   TYPES
========================= */

export type Scenario = {
  id: string;
  title: string;
  description: string | null;

  owner_id: string;

  created_at: string;
  created_by: string;

  updated_at: string;
  updated_by: string;
};

export type FacilitatorProfile = {
  id: string;
  email?: string | null;
  role?: string | null;
};

/* =========================
   HELPERS
========================= */

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");

  return uid;
}

/* =========================
   SCENARIOS
========================= */

export async function listScenarios(): Promise<Scenario[]> {
  const uid = await requireUserId();

  const { data, error } = await supabase
    .from("scenarios")
    .select(`
      id,
      title,
      description,
      owner_id,
      created_at,
      created_by,
      updated_at,
      updated_by
    `)
    .eq("owner_id", uid)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Scenario[];
}

export async function createScenario(title: string): Promise<Scenario> {
  const uid = await requireUserId();

  const { data, error } = await supabase
    .from("scenarios")
    .insert({
      title,
      owner_id: uid,
    })
    .select(`
      id,
      title,
      description,
      owner_id,
      created_at,
      created_by,
      updated_at,
      updated_by
    `)
    .single();

  if (error) throw error;
  return data as Scenario;
}

export async function deleteScenario(id: string) {
  const uid = await requireUserId();

  const { data, error } = await supabase
    .from("scenarios")
    .delete()
    .eq("id", id)
    .eq("owner_id", uid)
    .select("id");

  if (error) throw error;

  if (!data || data.length === 0) {
    throw new Error(
      "Delete failed (0 rows deleted). Most likely RLS policy blocks delete or owner_id is not set."
    );
  }
}

export async function transferScenarioOwnership(
  scenarioId: string,
  newOwnerId: string
) {
  const { error } = await supabase.rpc("transfer_scenario_ownership", {
    p_scenario_id: scenarioId,
    p_new_owner: newOwnerId,
  });

  if (error) throw error;
}

/* =========================
   FACILITATORS
========================= */

export async function listFacilitators(): Promise<FacilitatorProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("role", "facilitator")
    .order("email", { ascending: true });

  if (error) throw error;
  return (data ?? []) as FacilitatorProfile[];
}

/* =========================
   SHARE
========================= */

export async function shareScenario(
  scenarioId: string,
  sharedWithUserId: string,
  permission: "read" | "edit" = "read"
) {
  const { error } = await supabase
    .from("scenario_shares")
    .upsert({
      scenario_id: scenarioId,
      shared_with: sharedWithUserId,
      permission,
    });

  if (error) throw error;
}

export async function revokeScenarioShare(
  scenarioId: string,
  sharedWithUserId: string
) {
  const { error } = await supabase
    .from("scenario_shares")
    .delete()
    .eq("scenario_id", scenarioId)
    .eq("shared_with", sharedWithUserId);

  if (error) throw error;
}
