import { supabase } from "./supabaseClient";

/* =========================
   TYPES
========================= */

export type Session = {
  id: string;
  scenario_id: string;
  title: string;
  status: "draft" | "live" | "ended";
  join_code: string;
  created_at: string;
};

export type ScenarioListItem = {
  id: string;
  title: string;
};

/* =========================
   LISTS
========================= */

export async function listScenarios(): Promise<ScenarioListItem[]> {
  const { data, error } = await supabase
    .from("scenarios")
    .select("id, title")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/* =========================
   CREATE / CONTROL
========================= */

function randomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createSessionFromScenario(params: {
  scenarioId: string;
  title: string;
}): Promise<Session> {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      scenario_id: params.scenarioId,
      title: params.title,
      status: "draft",
      join_code: randomCode(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Session;
}

export async function setSessionStatus(
  sessionId: string,
  status: "draft" | "live" | "ended"
) {
  const { error } = await supabase
    .from("sessions")
    .update({ status })
    .eq("id", sessionId);

  if (error) throw error;
}

export async function restartSession(sessionId: string) {
  // wipe runtime tables
  await supabase.from("session_injects").delete().eq("session_id", sessionId);
  await supabase.from("session_actions").delete().eq("session_id", sessionId);
  await supabase.from("session_situation").delete().eq("session_id", sessionId);

  // back to draft
  await setSessionStatus(sessionId, "draft");
}
