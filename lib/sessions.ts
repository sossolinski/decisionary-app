import { supabase } from "./supabaseClient";

/* ========================= TYPES ========================= */

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
  delivered_at: string;
  inject_id: string;
  injects: Inject | null;
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

export type PagedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

/* ========================= SITUATION ========================= */

export async function getSessionSituation(sessionId: string) {
  const { data, error } = await supabase
    .from("session_situation")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return data as SessionSituation | null;
}

/* ========================= INBOX (session_injects) ========================= */
/**
 * Backwards compatible:
 * - if opts omitted => returns ALL items (old behavior)
 * - if opts provided => returns paged result
 */
export async function getSessionInbox(
  sessionId: string,
  opts?: { page?: number; pageSize?: number }
): Promise<SessionInject[] | PagedResult<SessionInject>> {
  const select = `
    id, session_id, delivered_at, inject_id,
    injects:inject_id ( id, title, body, channel, severity, sender_name, sender_org )
  `;

  // Old behavior (no pagination)
  if (!opts) {
    const { data, error } = await supabase
      .from("session_injects")
      .select(select)
      .eq("session_id", sessionId)
      .order("delivered_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as SessionInject[];
  }

  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, Math.min(50, opts.pageSize ?? 5));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("session_injects")
    .select(select, { count: "exact" })
    .eq("session_id", sessionId)
    .order("delivered_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    items: (data ?? []) as SessionInject[],
    total: count ?? 0,
    page,
    pageSize,
  };
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

/* ========================= PULSE ========================= */
/**
 * Pulse = messages delivered to session where injects.channel = "pulse"
 * We still subscribe to ALL session_injects changes and just reload+filter.
 */
export async function getSessionPulse(
  sessionId: string,
  opts?: { page?: number; pageSize?: number }
): Promise<PagedResult<SessionInject>> {
  const select = `
    id, session_id, delivered_at, inject_id,
    injects:inject_id ( id, title, body, channel, severity, sender_name, sender_org )
  `;

  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.max(1, Math.min(50, opts?.pageSize ?? 5));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Filter on joined table field (PostgREST)
  const { data, error, count } = await supabase
    .from("session_injects")
    .select(select, { count: "exact" })
    .eq("session_id", sessionId)
    .eq("injects.channel", "pulse")
    .order("delivered_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    items: (data ?? []) as SessionInject[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export function subscribePulse(sessionId: string, cb: () => void) {
  // We subscribe to session_injects for the session; PulseFeed reloads and filters by injects.channel
  const ch = supabase
    .channel(`pulse:${sessionId}`)
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

/* ========================= ACTIONS LOG ========================= */

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

/* ========================= SEND INJECT TO SESSION (MVP) ========================= */

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

/* ========================= FACILITATOR: deliverDueInjects (MVP) ========================= */

export async function deliverDueInjects(sessionId: string) {
  // 0) fetch scenario_id for the session
  const { data: sess, error: sessErr } = await supabase
    .from("sessions")
    .select("id, scenario_id")
    .eq("id", sessionId)
    .single();

  if (sessErr) throw sessErr;

  const scenarioId = (sess as any)?.scenario_id;
  if (!scenarioId) return { delivered: 0 };

  // 1) find scenario injects that are due now
  const { data: due, error: dueErr } = await supabase
    .from("scenario_injects")
    .select("id, scenario_id, inject_id, scheduled_at")
    .eq("scenario_id", scenarioId)
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true });

  if (dueErr) throw dueErr;

  const dueRows = due ?? [];
  if (dueRows.length === 0) return { delivered: 0 };

  // 2) avoid duplicates
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

/* ========================= CASUALTIES UPDATE ========================= */

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
