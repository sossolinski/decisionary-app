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
  role_key?: string | null;
  scenario_role_id?: string | null;
  assigned_at: string | null;
};

export type ParticipantSession = {
  id: string;
  title: string | null;
  join_code: string;
  status: string;
  joined_at: string | null;
  created_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  my_role_key: string | null;
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

async function tryRpc<T>(
  fn: string,
  args: Record<string, unknown>
): Promise<T | null> {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (!error) return data as T;

  const msg = String(error.message ?? "").toLowerCase();
  if (msg.includes("does not exist") || msg.includes("function")) return null;

  throw error;
}

/* =========================
   SCENARIOS
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

  for (const row of (data ?? []) as Array<{ id?: string } & SessionScenarioLite>) {
    if (row?.id) map.set(row.id, row as SessionScenarioLite);
  }
  return map;
}

export async function listSessions(): Promise<Session[]> {
  await requireUserId();

  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id,title,scenario_id,join_code,status,created_at,created_by,started_at,ended_at"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    title: string | null;
    scenario_id: string | null;
    join_code: string;
    status: string;
    created_at: string | null;
    created_by: string | null;
    started_at: string | null;
    ended_at: string | null;
  }>;
  const scenarioIds = rows.map((r) => r?.scenario_id).filter(Boolean) as string[];
  const scenarioMap = await fetchScenarioLiteByIds(scenarioIds);

  return rows.map((r) => {
    const sid = (r?.scenario_id ?? null) as string | null;
    const scenario = sid ? scenarioMap.get(sid) ?? null : null;

    return {
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
    } as Session;
  });
}

/* =========================
   PARTICIPANT: MY SESSIONS
========================= */

export async function listMyParticipantSessions(): Promise<ParticipantSession[]> {
  const uid = await requireUserId();

  // Preferred: session_role_assignments + embedded sessions
  const { data, error } = await supabase
    .from("session_role_assignments")
    .select(
      `
      session_id,
      role_key,
      assigned_at,
      sessions:session_id (
        id,
        title,
        join_code,
        status,
        created_at,
        started_at,
        ended_at
      )
    `
    )
    .eq("user_id", uid)
    .order("assigned_at", { ascending: false });

  if (!error && data) {
    const rows = data as unknown as Array<{
      role_key: string | null;
      assigned_at: string | null;
      sessions:
        | {
            id: string;
            title: string | null;
            join_code: string;
            status: string;
            created_at: string | null;
            started_at: string | null;
            ended_at: string | null;
          }
        | Array<{
            id: string;
            title: string | null;
            join_code: string;
            status: string;
            created_at: string | null;
            started_at: string | null;
            ended_at: string | null;
          }>
        | null;
    }>;

    return rows
      .map((r) => {
        const sRaw = r.sessions;
        const s = Array.isArray(sRaw) ? (sRaw[0] ?? null) : sRaw;
        if (!s?.id) return null;

        return {
          id: s.id,
          title: s.title ?? null,
          join_code: s.join_code,
          status: s.status,
          joined_at: r.assigned_at ?? null,
          created_at: s.created_at ?? null,
          started_at: s.started_at ?? null,
          ended_at: s.ended_at ?? null,
          my_role_key: r.role_key ?? null,
        } as ParticipantSession;
      })
      .filter(Boolean) as ParticipantSession[];
  }

  // Fallback (no embed support)
  const { data: assigns, error: e2 } = await supabase
    .from("session_role_assignments")
    .select("session_id, role_key, assigned_at")
    .eq("user_id", uid);

  if (e2) throw e2;

  const assignmentRows = (assigns ?? []) as Array<{
    session_id: string;
    role_key: string | null;
    assigned_at: string | null;
  }>;

  const sessionIds = assignmentRows.map((a) => a.session_id).filter(Boolean);
  if (sessionIds.length === 0) return [];

  const { data: sessions, error: e3 } = await supabase
    .from("sessions")
    .select("id,title,join_code,status,created_at,started_at,ended_at")
    .in("id", sessionIds);

  if (e3) throw e3;

  const assignmentBySession = new Map<
    string,
    { roleKey: string | null; joinedAt: string | null }
  >();
  for (const a of assignmentRows) {
    assignmentBySession.set(a.session_id, {
      roleKey: a.role_key ?? null,
      joinedAt: a.assigned_at ?? null,
    });
  }

  return (sessions ?? []).map((s) => {
    const assignment = assignmentBySession.get(s.id);
    return {
      id: s.id,
      title: s.title ?? null,
      join_code: s.join_code,
      status: s.status,
      joined_at: assignment?.joinedAt ?? null,
      created_at: s.created_at ?? null,
      started_at: s.started_at ?? null,
      ended_at: s.ended_at ?? null,
      my_role_key: assignment?.roleKey ?? null,
    };
  }) as ParticipantSession[];
}

/* =========================
   CREATE SESSION
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

  const sessionId = data as string;

  const granted = await tryRpc("grant_session_role", {
    p_session_id: sessionId,
    p_role_key: "facilitator",
    p_user_id: null,
  });

  if (granted === null) {
    await supabase.from("session_role_assignments").insert({
      session_id: sessionId,
      user_id: await requireUserId(),
      role_key: "facilitator",
    });
  }

  return sessionId;
}

/* =========================
   STATUS
========================= */

export async function setSessionStatus(
  sessionId: string,
  status: "draft" | "live" | "ended"
) {
  await requireUserId();

  if (status === "live") {
    const ok = await tryRpc("start_session", { p_session_id: sessionId });
    if (ok !== null) return;
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
   DELETE
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
    throw new Error("Delete blocked by RLS or not owned.");
  }
}

/* =========================
   JOIN BY CODE
========================= */

export async function joinSessionByCode(code: string): Promise<string> {
  await requireUserId();

  const joinCode = normCode(code);

  const sid = await tryRpc<string>("join_session", { p_code: joinCode });
  if (sid) return sid;

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

  const rows = (data ?? []) as unknown as Array<{
    user_id: string;
    joined_at: string | null;
    profile:
      | { id: string; email: string | null }
      | Array<{ id: string; email: string | null }>
      | null;
  }>;

  return rows.map((row) => {
    const profileRaw = row.profile;
    const profile = Array.isArray(profileRaw) ? (profileRaw[0] ?? null) : profileRaw;
    return {
      user_id: row.user_id,
      joined_at: row.joined_at ?? null,
      profile: profile ? { id: profile.id, email: profile.email ?? null } : null,
    };
  });
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

  return (data ?? []).map((r) => ({
    id: r.id,
    session_id: r.session_id,
    user_id: r.user_id,
    role_key: r.role_key ?? null,
    scenario_role_id: r.scenario_role_id ?? null,
    assigned_at: r.assigned_at ?? r.created_at ?? null,
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
