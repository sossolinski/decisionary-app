import { supabase } from "./supabaseClient";

/* =======================
   SITUATION (COP)
======================= */

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

export async function getSessionSituation(sessionId: string) {
  const { data, error } = await supabase
    .from("session_situation")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return data as SessionSituation | null;
}

export async function updateCasualties(params: {
  sessionId: string;
  injured: number;
  fatalities: number;
  uninjured: number;
  unknown: number;
}) {
  const { sessionId, injured, fatalities, uninjured, unknown } = params;

  const { data, error } = await supabase.rpc("update_casualties", {
    p_session_id: sessionId,
    p_injured: injured,
    p_fatalities: fatalities,
    p_uninjured: uninjured,
    p_unknown: unknown,
  });

  if (error) throw error;
  return data as SessionSituation;
}

/* =======================
   INBOX (SESSION_INJECTS)
======================= */

export type SessionInject = {
  id: string;
  session_id: string;
  scenario_id: string | null;
  inject_id: string;
  delivered_at: string;
  delivered_by: string | null;
  status: string;
  injects: {
    title: string;
    body: string;
    channel: string;
    sender_name: string | null;
    sender_org: string | null;
    severity: string | null;
    created_at: string;
  } | null;
};

export type InboxPage = {
  items: SessionInject[];
  total: number;
  page: number;
  pageSize: number;
};

// Overloads for backward compatibility
export async function getSessionInbox(sessionId: string): Promise<SessionInject[]>;
export async function getSessionInbox(
  sessionId: string,
  opts: { page?: number; pageSize?: number }
): Promise<InboxPage>;

/**
 * getSessionInbox
 * - legacy: getSessionInbox(sessionId) => SessionInject[]
 * - paged:  getSessionInbox(sessionId, { page, pageSize }) => { items, total, page, pageSize }
 */
export async function getSessionInbox(
  sessionId: string,
  opts?: { page?: number; pageSize?: number }
): Promise<SessionInject[] | InboxPage> {
  const selectStr = `
    id, session_id, scenario_id, inject_id, delivered_at, delivered_by, status,
    injects ( title, body, channel, sender_name, sender_org, severity, created_at )
  `;

  // Legacy (no pagination) — keep existing behavior
  if (!opts) {
    const { data, error } = await supabase
      .from("session_injects")
      .select(selectStr)
      .eq("session_id", sessionId)
      .order("delivered_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as SessionInject[];
  }

  // Paged
  const pageSize = opts.pageSize ?? 5;
  const page = Math.max(1, opts.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("session_injects")
    .select(selectStr, { count: "exact" })
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

export async function deliverDueInjects(sessionId: string) {
  const { data, error } = await supabase.rpc("deliver_due_injects", {
    p_session_id: sessionId,
  });

  if (error) throw error;
  return data as number;
}

/* =======================
   AD-HOC INJECT (CREATE + DELIVER)
======================= */

export async function sendInjectToSession(sessionId: string, title: string, body: string) {
  const { data: inject, error: injectError } = await supabase
    .from("injects")
    .insert({ title, body })
    .select("id")
    .single();

  if (injectError) throw injectError;

  const { error: deliverError } = await supabase.from("session_injects").insert({
    session_id: sessionId,
    inject_id: inject.id,
    scenario_id: null,
    delivered_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    delivered_at: new Date().toISOString(),
    status: "delivered",
  });

  if (deliverError) throw deliverError;

  return inject.id as string;
}

/* =======================
   ACTIONS (SESSION_ACTIONS)
======================= */

export type SessionAction = {
  id: string;
  session_id: string;
  session_inject_id: string | null;
  source: "inbox" | "pulse";
  action_type: "ignore" | "escalate" | "act";
  comment: string | null;
  created_at: string;
  created_by: string | null;
};

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
  comment?: string | null;
}) {
  const { sessionId, sessionInjectId, source, actionType, comment } = params;

  const { data, error } = await supabase
    .from("session_actions")
    .insert({
      session_id: sessionId,
      session_inject_id: sessionInjectId,
      source,
      action_type: actionType,
      comment: comment ?? null,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as SessionAction;
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

  /* =======================
   PULSE (DB-native via view: session_pulse_view)
   - view filters injects.channel IN ('pulse','social')
======================= */

export type PulseItem = {
  id: string;
  session_id: string;
  scenario_id: string | null;
  inject_id: string;
  delivered_at: string;
  delivered_by: string | null;
  status: string;

  title: string | null;
  body: string | null;
  channel: string | null;
  severity: string | null;
  sender_name: string | null;
  sender_org: string | null;
  inject_created_at: string | null;
};

export type PulsePage = {
  items: PulseItem[];
  total: number;
  page: number;
  pageSize: number;
};

export async function getSessionPulse(
  sessionId: string,
  opts?: { page?: number; pageSize?: number }
): Promise<PulsePage> {
  const pageSize = opts?.pageSize ?? 5;
  const page = Math.max(1, opts?.page ?? 1);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("session_pulse_view")
    .select(
      "id, session_id, scenario_id, inject_id, delivered_at, delivered_by, status, title, body, channel, severity, sender_name, sender_org, inject_created_at",
      { count: "exact" }
    )
    .eq("session_id", sessionId)
    .order("delivered_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    items: (data ?? []) as PulseItem[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export function subscribePulse(sessionId: string, cb: () => void) {
  // Realtime słuchamy na base table, bo view nie ma realtime
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
