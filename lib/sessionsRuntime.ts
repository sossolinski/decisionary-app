// lib/sessionsRuntime.ts
import { supabase } from "./supabaseClient";

/* =========================
   TYPES
========================= */

export type ScenarioListItem = {
  id: string;
  title: string;
};

export type SessionScenarioLite = {
  id: string;
  title: string;
  short_description: string | null;

  event_date: string | null;
  event_time: string | null;
  timezone: string | null;
  location: string | null;
};

export type Session = {
  id: string;
  title: string | null;
  scenario_id: string | null;

  // populated client-side (2nd query), no FK/embed required
  scenario: SessionScenarioLite | null;

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

  // exists in DB (we added), but PostgREST schema cache may still lag
  role_key?: string | null;

  // exists in your DB according to your screenshot
  scenario_role_id?: string | null;

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
   SESSIONS LIST (NO EMBED)
========================= */

async function fetchScenarioLiteByIds(
  ids: string[]
): Promise<Map<string, SessionScenarioLite>> {
  const uniq = Array.from(new Set(ids)).filter(Boolean);
  const map = new Map<string, SessionScenarioLite>();
  if (uniq.length === 0) return map;

  const { data, error } = await supabase
    .from("scenarios")
    .select("id,title,short_description,event_date,event_time,timezone,location")
    .in("id", uniq);

  if (error) throw error;

  for (const row of (data ?? []) as any[]) {
    if (row?.id) map.set(row.id, row as SessionScenarioLite);
  }
  return map;
}

export async function listSessions(): Promise<Session[]> {
  await requireUserId();

  // 1) sessions without any relational embed (fixes schema cache FK error)
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id,title,scenario_id,join_code,status,created_at,created_by,started_at,ended_at"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as any[];

  // 2) hydrate scenario lite via separate query (no FK required)
  const scenarioIds = rows.map((r) => r?.scenario_id).filter(Boolean) as string[];
  const scenarioMap = await fetchScenarioLiteByIds(scenarioIds);

  return rows.map((r) => {
    const sid = (r?.scenario_id ?? null) as string | null;
    const scenario = sid ? scenarioMap.get(sid) ?? null : null;

    const out: Session = {
      id: r.id,
      title: r.title ?? null,
      scenario_id: sid,
      scenario,
      join_code: r.join_code,
      status: r.status,
      created_at: r.created_at ?? null,
      created_by: r.created_by ?? null,
      started_at: r.started_at ?? null,
      ended_at: r.ended_at ?? null,
    };

    return out;
  });
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
   ROSTER / ROLES
========================= */

export async function ensureSessionRoleSlots(sessionId: string): Promise<void> {
  await requireUserId();

  const { error: rpcErr } = await supabase.rpc("ensure_session_role_slots", {
    p_session_id: sessionId,
  });

  // If RPC doesn't exist in your DB yet — silently ignore.
  if (!rpcErr) return;

  if (
    String(rpcErr?.message ?? "").toLowerCase().includes("does not exist") ||
    String(rpcErr?.message ?? "").toLowerCase().includes("function")
  ) {
    return;
  }

  throw rpcErr;
}

export async function listSessionParticipants(
  sessionId: string
): Promise<SessionParticipant[]> {
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
  return (data ?? []) as any;
}

/**
 * IMPORTANT:
 * We use "*" to avoid PostgREST schema cache issues with recently added columns.
 */
export async function listSessionRoleAssignments(
  sessionId: string
): Promise<SessionRoleAssignment[]> {
  await requireUserId();

  const { data, error } = await supabase
    .from("session_role_assignments")
    .select("*")
    .eq("session_id", sessionId)
    .order("assigned_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id: r.id,
    session_id: r.session_id,
    user_id: r.user_id,
    role_key: r.role_key ?? null,
    scenario_role_id: r.scenario_role_id ?? null,
    assigned_at: r.assigned_at ?? null,
  })) as SessionRoleAssignment[];
}

/**
 * Simplified: write role_key only.
 * (No dependency on session_role_slots — table may not exist in DB.)
 */
export async function assignUserToSessionRole(params: {
  sessionId: string;
  userId: string;
  roleKey: string;
}) {
  await requireUserId();

  const { sessionId, userId, roleKey } = params;

  const { error } = await supabase
    .from("session_role_assignments")
    .upsert(
      {
        session_id: sessionId,
        user_id: userId,
        role_key: roleKey,
        assigned_at: new Date().toISOString(),
      } as any,
      { onConflict: "session_id,user_id" }
    );

  if (error) throw error;
}

/**
 * DB may not have session_role_slots. Return empty list to avoid hard failure.
 */
export async function listSessionRoleSlots(sessionId: string): Promise<SessionRoleSlot[]> {
  await requireUserId();
  return [];
}

/* =========================
   ROSTER (UI helper)
========================= */

export type SessionRosterRow = {
  participant_id: string;
  display_name: string | null;
  role: string | null;
  joined_at: string | null;
};

export async function listSessionRoster(sessionId: string): Promise<SessionRosterRow[]> {
  await requireUserId();

  const [participants, assignments] = await Promise.all([
    listSessionParticipants(sessionId),
    listSessionRoleAssignments(sessionId),
  ]);

  const roleByUser = new Map<string, string>();
  for (const a of assignments ?? []) {
    const role = (a as any)?.role_key ?? null;
    if (a?.user_id && role) roleByUser.set(a.user_id, String(role));
  }

  return (participants ?? []).map((p) => ({
    participant_id: p.user_id,
    display_name: p.profile?.email ?? null,
    role: roleByUser.get(p.user_id) ?? null,
    joined_at: p.joined_at ?? null,
  }));
}

export async function kickFromSession(sessionId: string, participantId: string) {
  await requireUserId();

  const { error } = await supabase
    .from("session_participants")
    .delete()
    .eq("session_id", sessionId)
    .eq("user_id", participantId);

  if (error) throw error;
}
