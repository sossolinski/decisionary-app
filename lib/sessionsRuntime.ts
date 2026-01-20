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

export type SessionParticipant = {
  id: string;
  session_id: string;
  user_id: string;
  joined_at: string;
};

export type SessionRoleAssignment = {
  id: string;
  session_id: string;
  scenario_role_id: string;
  user_id: string | null;
  assigned_at: string;
  assigned_by: string | null;
};

export async function listSessionParticipants(sessionId: string) {
  const { data, error } = await supabase
    .from("session_participants")
    .select("*")
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SessionParticipant[];
}

export async function listSessionRoleAssignments(sessionId: string) {
  const { data, error } = await supabase
    .from("session_role_assignments")
    .select(
      `
        *,
        scenario_roles:scenario_role_id (
          id,
          scenario_id,
          role_key,
          role_name,
          role_description,
          sort_order,
          is_required
        )
      `
    )
    .eq("session_id", sessionId)
    .order("assigned_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as any[];
}

/**
 * Tworzy "sloty ról" dla sesji na podstawie scenario_roles.
 * Wywołuj to po utworzeniu sesji (createSessionFromScenario) albo przy otwarciu roster (idempotent).
 */
export async function ensureSessionRoleSlots(sessionId: string) {
  // 1) get scenario_id for session
  const { data: sess, error: sessErr } = await supabase
    .from("sessions")
    .select("id, scenario_id")
    .eq("id", sessionId)
    .single();

  if (sessErr) throw sessErr;

  const scenarioId = (sess as any).scenario_id as string | null;
  if (!scenarioId) return { created: 0 };

  // 2) scenario roles
  const { data: roles, error: rolesErr } = await supabase
    .from("scenario_roles")
    .select("id")
    .eq("scenario_id", scenarioId);

  if (rolesErr) throw rolesErr;

  const roleIds = (roles ?? []).map((r: any) => r.id);
  if (roleIds.length === 0) return { created: 0 };

  // 3) existing slots
  const { data: existing, error: exErr } = await supabase
    .from("session_role_assignments")
    .select("scenario_role_id")
    .eq("session_id", sessionId)
    .in("scenario_role_id", roleIds);

  if (exErr) throw exErr;

  const existingSet = new Set((existing ?? []).map((e: any) => e.scenario_role_id));
  const missing = roleIds.filter((id) => !existingSet.has(id));
  if (missing.length === 0) return { created: 0 };

  // 4) insert missing slots (user_id null)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const inserts = missing.map((scenarioRoleId) => ({
    session_id: sessionId,
    scenario_role_id: scenarioRoleId,
    user_id: null,
    assigned_by: user?.id ?? null,
  }));

  const { error: insErr } = await supabase
  .from("session_role_assignments")
  .upsert(inserts, { onConflict: "session_id,scenario_role_id", ignoreDuplicates: true });

if (insErr) throw insErr;


  return { created: missing.length };
}

/**
 * Przypisuje usera do roli w sesji (albo czyści przypisanie, jeśli userId = null).
 * Wymaga, żeby slot istniał — dlatego zwykle wołasz wcześniej ensureSessionRoleSlots().
 */
export async function assignUserToSessionRole(params: {
  sessionId: string;
  scenarioRoleId: string;
  userId: string | null;
}) {
  const { sessionId, scenarioRoleId, userId } = params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("session_role_assignments")
    .update({
      user_id: userId,
      assigned_at: new Date().toISOString(),
      assigned_by: user?.id ?? null,
    })
    .eq("session_id", sessionId)
    .eq("scenario_role_id", scenarioRoleId)
    .select("*")
    .single();

  if (error) throw error;
  return data as SessionRoleAssignment;
}

/**
 * Pobiera rolę scenariuszową zalogowanego usera w danej sesji.
 * Idealne do: pokazania "OPS/PR" w headerze roomu i ograniczeń UI.
 */
export async function getMyScenarioRoleInSession(sessionId: string) {
  const {
    data: { user },
    error: uErr,
  } = await supabase.auth.getUser();

  if (uErr) throw uErr;
  if (!user) return null;

  const { data, error } = await supabase
    .from("session_role_assignments")
    .select(
      `
        id,
        session_id,
        user_id,
        scenario_roles:scenario_role_id (
          id, role_key, role_name
        )
      `
    )
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    roleKey: (data as any).scenario_roles?.role_key as string,
    roleName: (data as any).scenario_roles?.role_name as string,
  };
}
