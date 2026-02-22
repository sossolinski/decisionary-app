// lib/sessionsRuntime.ts
import { supabase } from "./supabaseClient";
import { assertNonEmptyTrimmed, assertValidJoinCode, normalizeJoinCode } from "./validation";

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

  // hydrated client-side (2nd query), no FK/embed required
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

export type ParticipantRow = {
  user_id: string;
  joined_at: string | null;
  profile: { id: string; email: string | null } | null;
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

  // schema cache may lag; keep optional
  role_key?: string | null;

  // legacy columns may exist
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


async function tryRpc<T>(
  fn: string,
  args: Record<string, unknown>
): Promise<T | null> {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (!error) return data as T;

  const msg = String(error.message ?? "").toLowerCase();
  // treat missing function as "not available"
  if (msg.includes("does not exist") || msg.includes("function")) return null;

  throw error;
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

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const id = row["id"];
    if (typeof id === "string") map.set(id, row as SessionScenarioLite);
  }
  return map;
}

export async function listSessions(): Promise<Session[]> {
  await requireUserId();

  // sessions without relational embed (avoids schema cache FK errors)
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id,title,scenario_id,join_code,status,created_at,created_by,started_at,ended_at"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const scenarioIds = rows
    .map((r) => r["scenario_id"])
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const scenarioMap = await fetchScenarioLiteByIds(scenarioIds);

  return rows.map((r) => {
    const sid = typeof r["scenario_id"] === "string" ? r["scenario_id"] : null;
    const scenario = sid ? scenarioMap.get(sid) ?? null : null;

    return {
      id: String(r["id"] ?? ""),
      title: typeof r["title"] === "string" ? r["title"] : null,
      scenario_id: sid,
      scenario,
      join_code: String(r["join_code"] ?? ""),
      status: String(r["status"] ?? "draft"),
      created_at: typeof r["created_at"] === "string" ? r["created_at"] : null,
      created_by: typeof r["created_by"] === "string" ? r["created_by"] : null,
      started_at: typeof r["started_at"] === "string" ? r["started_at"] : null,
      ended_at: typeof r["ended_at"] === "string" ? r["ended_at"] : null,
    } as Session;
  });
}

/* =========================
   CREATE SESSION
========================= */

export async function createSessionFromScenario(params: {
  scenarioId: string;
  title: string;
}): Promise<string> {
  await requireUserId();

  const title = assertNonEmptyTrimmed(params.title, "Session title");

  const { data, error } = await supabase.rpc("create_session_from_scenario", {
    p_scenario_id: params.scenarioId,
    p_title: title,
  });

  if (error) throw error;

  const sessionId = data as string;

  // ✅ ensure creator gets facilitator role for this session
  // prefer RPC (security definer), fallback to direct insert
  const granted = await tryRpc("grant_session_role", {
    p_session_id: sessionId,
    p_role_key: "facilitator",
    p_user_id: null,
  });

  if (granted === null) {
    // fallback (may be blocked by RLS depending on your policies)
    await supabase.from("session_role_assignments").insert({
      session_id: sessionId,
      user_id: await requireUserId(),
      role_key: "facilitator",
    });
  }

  return sessionId;
}

/* =========================
   STATUS / START / END
========================= */

export async function setSessionStatus(
  sessionId: string,
  status: "draft" | "live" | "ended"
) {
  await requireUserId();

  if (status === "live") {
    // prefer RPC start_session(p_session_id)
    const ok = await tryRpc("start_session", { p_session_id: sessionId });
    if (ok !== null) return;
    // fallback: direct update
  }

  const patch: { status: "draft" | "live" | "ended"; ended_at?: string } = { status };
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
      "Delete failed (0 rows deleted).\nMost likely RLS blocks delete or row not owned."
    );
  }
}

/* =========================
   JOIN BY CODE
========================= */

export async function joinSessionByCode(code: string): Promise<string> {
  await requireUserId();

  const joinCode = normalizeJoinCode(code);
  assertValidJoinCode(joinCode);

  // prefer RPC join_session(p_code)
  const sid = await tryRpc<string>("join_session", { p_code: joinCode });
  if (sid) return sid;

  // fallback: old client-side lookup
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

  if (!rpcErr) return;

  const msg = String(rpcErr?.message ?? "").toLowerCase();
  if (msg.includes("does not exist") || msg.includes("function")) return;

  throw rpcErr;
}

export async function listSessionParticipants(
  sessionId: string
): Promise<SessionParticipant[]> {
  await requireUserId();

  const { data, error } = await supabase
    .from("session_participants")
    .select(
      `user_id, joined_at, profile:profiles!session_participants_user_id_fkey ( id, email )`
    )
    .eq("session_id", sessionId)
    .order("joined_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ParticipantRow[];
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
    .eq("session_id", sessionId);

  if (error) throw error;

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r["id"] ?? ""),
    session_id: String(r["session_id"] ?? ""),
    user_id: String(r["user_id"] ?? ""),
    role_key: typeof r["role_key"] === "string" ? r["role_key"] : null,
    scenario_role_id:
      typeof r["scenario_role_id"] === "string" ? r["scenario_role_id"] : null,
    assigned_at:
      typeof r["assigned_at"] === "string"
        ? r["assigned_at"]
        : typeof r["created_at"] === "string"
          ? r["created_at"]
          : null,
  })) as SessionRoleAssignment[];
}

export async function assignUserToSessionRole(params: {
  sessionId: string;
  userId: string;
  roleKey: string;
}) {
  await requireUserId();

  // prefer RPC (handles legacy cols + RLS safely)
  const ok = await tryRpc("grant_session_role", {
    p_session_id: params.sessionId,
    p_role_key: params.roleKey,
    p_user_id: params.userId,
  });

  if (ok !== null) return;

  // fallback direct upsert
  const { error } = await supabase.from("session_role_assignments").upsert(
    {
      session_id: params.sessionId,
      user_id: params.userId,
      role_key: params.roleKey,
      assigned_at: new Date().toISOString(),
    },
    { onConflict: "session_id,user_id,role_key" }
  );

  if (error) throw error;
}

export async function listSessionRoleSlots(
  sessionId: string
): Promise<SessionRoleSlot[]> {
  await requireUserId();
  void sessionId;
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
    const role = a?.role_key ?? null;
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
