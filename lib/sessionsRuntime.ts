// lib/sessionsRuntime.ts
import { supabase } from "./supabaseClient";

/* =========================
   TYPES
========================= */

export type ScenarioListItem = {
  id: string;
  title: string;
};

export type Session = {
  id: string;
  title: string | null;
  scenario_id: string | null;
  join_code: string;
  status: "draft" | "live" | "ended" | string;

  created_at: string | null;
  created_by: string | null;

  started_at: string | null;
  ended_at: string | null;
};

export type ProfileLite = {
  id: string;
  email: string | null;
};

export type SessionParticipant = {
  user_id: string;
  joined_at: string | null;
  profile: ProfileLite | null;
};

export type SessionRoleSlot = {
  id: string;
  session_id: string;
  role_key: string;
  capacity: number | null;
};

export type SessionRoleAssignment = {
  id: string;
  session_id: string;
  user_id: string;
  role_key: string;
  assigned_at: string | null;
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

function normCode(code: string) {
  return code.trim().toUpperCase();
}

/* =========================
   SCENARIOS (for dropdown)
========================= */

export async function listScenarios(): Promise<ScenarioListItem[]> {
  await requireUserId();

  const { data, error } = await supabase
    .from("scenarios")
    .select("id, title")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ScenarioListItem[];
}

/* =========================
   SESSIONS LIST
========================= */

export async function listSessions(): Promise<Session[]> {
  await requireUserId();

  const { data, error } = await supabase
    .from("sessions")
    .select(
      `
      id,
      title,
      scenario_id,
      join_code,
      status,
      created_at,
      created_by,
      started_at,
      ended_at
    `
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Session[];
}

/* =========================
   CREATE SESSION (seed from scenario)
========================= */

export async function createSessionFromScenario(params: {
  scenarioId: string;
  title: string;
}): Promise<string> {
  await requireUserId();

  const { data, error } = await supabase.rpc("create_session_from_scenario", {
    p_scenario_id: params.scenarioId,
    p_title: params.title,
  });

  if (error) throw error;
  return data as string; // session_id
}

/* =========================
   STATUS / START / END
========================= */

export async function setSessionStatus(
  sessionId: string,
  status: "draft" | "live" | "ended"
) {
  await requireUserId();

  const patch: any = { status };

  if (status === "live") patch.started_at = new Date().toISOString();
  if (status === "ended") patch.ended_at = new Date().toISOString();

  const { error } = await supabase.from("sessions").update(patch).eq("id", sessionId);
  if (error) throw error;
}

/* =========================
   RESTART
========================= */

export async function restartSession(sessionId: string) {
  await requireUserId();

  const { error } = await supabase.rpc("restart_session", {
    p_session_id: sessionId,
  });

  if (error) throw error;
}

/* =========================
   DELETE SESSION
========================= */

export async function deleteSession(sessionId: string) {
  await requireUserId();

  const { data, error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .select("id");

  if (error) throw error;

  if (!data || data.length === 0) {
    throw new Error(
      "Delete failed (0 rows deleted). Most likely RLS policy blocks delete or row not owned."
    );
  }
}

/* =========================
   JOIN BY CODE
========================= */

export async function joinSessionByCode(code: string): Promise<string> {
  await requireUserId();

  const joinCode = normCode(code);

  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("join_code", joinCode)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error("Invalid join code");

  return data.id as string;
}

/* =========================
   ROSTER / ROLES (missing exports)
========================= */

/**
 * Ensures session role slots exist for this session.
 * Tries RPC first (recommended), then falls back to no-op.
 */
export async function ensureSessionRoleSlots(sessionId: string): Promise<void> {
  await requireUserId();

  // 1) try RPC (if you created it)
  const { error: rpcErr } = await supabase.rpc("ensure_session_role_slots", {
    p_session_id: sessionId,
  });

  if (!rpcErr) return;

  // 2) fallback: if no RPC exists, do nothing (build/runtime safe)
  // You can later replace with real logic based on your tables.
  if (
    String(rpcErr?.message ?? "").toLowerCase().includes("does not exist") ||
    String(rpcErr?.message ?? "").toLowerCase().includes("function")
  ) {
    return;
  }

  // If RPC exists but failed for other reason, surface it
  throw rpcErr;
}

/**
 * Lists session participants with their profile (email).
 * Expected tables:
 * - session_participants: { session_id, user_id, joined_at }
 * - profiles: { id, email }
 */
export async function listSessionParticipants(sessionId: string): Promise<SessionParticipant[]> {
  await requireUserId();

  const { data, error } = await supabase
    .from("session_participants")
    .select(
      `
      user_id,
      joined_at,
      profile:profiles!session_participants_user_id_fkey ( id, email )
    `
    )
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });

  if (error) throw error;

  // If your FK name differs, Supabase may error – wtedy podeślij błąd, dopasuję join.
  return (data ?? []) as any;
}

/**
 * Lists current role assignments for a session.
 * Expected table:
 * - session_role_assignments: { id, session_id, user_id, role_key, assigned_at }
 */
export async function listSessionRoleAssignments(
  sessionId: string
): Promise<SessionRoleAssignment[]> {
  await requireUserId();

  const { data, error } = await supabase
    .from("session_role_assignments")
    .select("id, session_id, user_id, role_key, assigned_at")
    .eq("session_id", sessionId)
    .order("assigned_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as SessionRoleAssignment[];
}

/**
 * Assigns (or re-assigns) a user to a role in a session.
 * Uses upsert so it's idempotent.
 */
export async function assignUserToSessionRole(params: {
  sessionId: string;
  userId: string;
  roleKey: string;
}) {
  await requireUserId();

  const { sessionId, userId, roleKey } = params;

  // If you want "one role per user" enforce UNIQUE(session_id, user_id)
  // If you want "one user per role slot" enforce UNIQUE(session_id, role_key) or a separate slots table.
  const { error } = await supabase
    .from("session_role_assignments")
    .upsert(
      {
        session_id: sessionId,
        user_id: userId,
        role_key: roleKey,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: "session_id,user_id" }
    );

  if (error) throw error;
}

/**
 * (optional helper) list role slots if your roster UI needs it
 */
export async function listSessionRoleSlots(sessionId: string): Promise<SessionRoleSlot[]> {
  await requireUserId();

  const { data, error } = await supabase
    .from("session_role_slots")
    .select("id, session_id, role_key, capacity")
    .eq("session_id", sessionId)
    .order("role_key", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SessionRoleSlot[];
}
