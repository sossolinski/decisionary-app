import { supabase } from "./supabaseClient";

export async function getSituationForSession(sessionId: string) {
  // 1) spróbuj session_situation
  const { data: sessionSituation, error: ssError } = await supabase
    .from("session_situation")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (ssError) throw ssError;

  if (sessionSituation) {
    return {
      source: "session",
      data: sessionSituation,
    };
  }

  // 2) fallback → scenario
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("scenario_id")
    .eq("id", sessionId)
    .single();

  if (sessionError) throw sessionError;
  if (!session.scenario_id) return null;

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select(`
      situation_type,
      short_description,
      location,
      injured,
      fatalities,
      uninjured,
      unknown
    `)
    .eq("id", session.scenario_id)
    .single();

  if (scenarioError) throw scenarioError;

  return {
    source: "scenario",
    data: scenario,
  };
}
