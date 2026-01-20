import { supabase } from "./supabaseClient";

/* =========================
   TYPES
========================= */

export type SessionSituation = {
  session_id: string;
  event_date: string | null;
  event_time: string | null;
  timezone: string | null;
  location: string | null;
  situation_type: string | null;
  short_description: string | null;
  injured: number;
  fatalities: number;
  uninjured: number;
  unknown: number;
  updated_at: string;
  updated_by: string | null;
};

export type Inject = {
  id: string;
  title: string | null;
  body: string | null;
  channel: string | null; // e.g. "ops" | "media" | "pulse" | "social"
  severity: string | null;
  sender_name: string | null;
  sender_org: string | null;
  created_at?: string;
};

export type SessionInject = {
  id: string;
  session_id: string;
  delivered_at: string; // in your schema this exists (or change to created_at if needed)
  inject_id: string;
  injects: Inject | null; // join
};

export type SessionAction = {
  id: string;
  session_id: string;
  session_inject_id: string | null;
  source: "inbox" | "pulse";
  action_type: "ignore" | "escalate" | "act";
  comment: string | null;
  created_at: string;
};

/* =========================
   SITUATION
========================= */

export async function getSessionSituation(sessionId: string) {
  const { data, error } = await supabase
    .from("session_situation")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return data as SessionSituation | null;
}

/* =========================
   INBOX (session_injects)
========================= */

export async function getSessionInbox(sessionId: string) {
  const { data, error } = await supabase
    .from("session_injects")
    .select(
      "id, session_id, delivered_at, inject_id, injects:inject_id ( id, title, body, channel, severity, sender_name, sender_org )"
    )
    .eq("session_id", sessionId)
    .order("delivered_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as SessionInject[];
}

export function subscribeInbox(sessionId: string, cb: () => void) {
  const ch = supabase
    .channel(`session_injects:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "session_injects",
        filter: `session_id=eq.${sessionId}`,
      },
      () => cb()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(ch);
  };
}

/* =========================
   ACTIONS LOG
========================= */

export async function getSessionActions(sessionId: string, limit = 50) {
  const { data, error } = await supabase
    .from("session_actions")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as SessionAction[];
}

export async function addSessionAction(params: {
  sessionId: string;
  sessionInjectId: string | null;
  source: "inbox" | "pulse";
  actionType: "ignore" | "escalate" | "act";
  comment: string | null;
}) {
  const { sessionId, sessionInjectId, source, actionType, comment } = params;

  const { data, error } = await supabase
    .from("session_actions")
    .insert({
      session_id: sessionId,
      session_inject_id: sessionInjectId,
      source,
      action_type: actionType,
      comment,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as SessionAction;
}

/* =========================
   SEND INJECT TO SESSION (MVP)
   - creates inject row
   - links it into session_injects
========================= */

export async function sendInjectToSession(
  sessionId: string,
  title: string,
  body: string,
  opts?: {
    channel?: string; // default "ops"
    severity?: string | null;
    sender_name?: string | null;
    sender_org?: string | null;
  }
) {
  const channel = opts?.channel ?? "ops";

  // 1) create inject
  const { data: inj, error: injErr } = await supabase
    .from("injects")
    .insert({
      title,
      body,
      channel,
      severity: opts?.severity ?? null,
      sender_name: opts?.sender_name ?? "System",
      sender_org: opts?.sender_org ?? "Decisionary",
    })
    .select("id")
    .single();

  if (injErr) throw injErr;

  // 2) attach to session
  const { error: linkErr } = await supabase.from("session_injects").insert({
    session_id: sessionId,
    inject_id: inj.id,
    delivered_at: new Date().toISOString(),
  });

  if (linkErr) throw linkErr;

  return inj.id as string;
}

/* =========================
   FACILITATOR: deliverDueInjects (MVP)
   - delivers scheduled scenario injects into session_injects
   - uses scenario_id from sessions table
========================= */

export async function deliverDueInjects(sessionId: string) {
  // 0) fetch scenario_id for the session
  const { data: sess, error: sessErr } = await supabase
    .from("sessions")
    .select("id, scenario_id")
    .eq("id", sessionId)
    .single();

  if (sessErr) throw sessErr;
  const scenarioId = sess?.scenario_id;
  if (!scenarioId) return { delivered: 0 };

  // 1) find scenario injects that are due now (ASSUMPTION: scenario_injects has scheduled_at)
  // If your column name is different: change "scheduled_at" below.
  const { data: due, error: dueErr } = await supabase
    .from("scenario_injects")
    .select("id, scenario_id, inject_id, scheduled_at")
    .eq("scenario_id", scenarioId)
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true });

  if (dueErr) throw dueErr;

  const dueRows = due ?? [];
  if (dueRows.length === 0) return { delivered: 0 };

  // 2) avoid duplicates: check which injects already delivered to this session
  const injectIds = Array.from(new Set(dueRows.map((r: any) => r.inject_id)));

  const { data: already, error: alreadyErr } = await supabase
    .from("session_injects")
    .select("inject_id")
    .eq("session_id", sessionId)
    .in("inject_id", injectIds);

  if (alreadyErr) throw alreadyErr;

  const alreadySet = new Set((already ?? []).map((r: any) => r.inject_id));
  const toDeliver = dueRows.filter((r: any) => !alreadySet.has(r.inject_id));

  if (toDeliver.length === 0) return { delivered: 0 };

  // 3) deliver into session_injects
  const inserts = toDeliver.map((r: any) => ({
    session_id: sessionId,
    inject_id: r.inject_id,
    delivered_at: new Date().toISOString(),
  }));

  const { error: insErr } = await supabase.from("session_injects").insert(inserts);
  if (insErr) throw insErr;

  return { delivered: toDeliver.length };
}

/* =========================
   CASUALTIES UPDATE
========================= */

export async function updateCasualties(params: {
  sessionId: string;
  injured: number;
  fatalities: number;
  uninjured: number;
  unknown: number;
}) {
  const { sessionId, injured, fatalities, uninjured, unknown } = params;

  const { data, error } = await supabase
    .from("session_situation")
    .update({
      injured,
      fatalities,
      uninjured,
      unknown,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId)
    .select("*")
    .single();

  if (error) throw error;
  return data as SessionSituation;
}
