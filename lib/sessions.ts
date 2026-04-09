// lib/sessions.ts
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
  inject_kind?: "operational" | "media" | "social" | "intel" | "internal" | "system" | null;
  source_type?: "scheduled" | "manual" | "conditional" | "consequence" | null;
  entity_scope?: string | null;
  requires_decision?: boolean;
  decision_template_key?: string | null;
  visibility_scope?: string | null;
  branch_key?: string | null;
  created_at?: string;
};

export type SessionInject = {
  id: string;
  session_id: string;
  delivered_at: string;
  inject_id: string;
  injects: Inject | null; // join
};

export type PulseItem = SessionInject;

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
};

/* =========================
   HELPERS
========================= */

// Supabase embed can sometimes come back as object OR array depending on query shape.
// Normalize to a single object for our types.
function normalizeInject(v: unknown): Inject | null {
  if (!v) return null;
  const item = Array.isArray(v) ? (v[0] ?? null) : v;
  return item ? (item as Inject) : null;
}

function normalizeSessionInjectRow(
  row: Omit<SessionInject, "injects"> & { injects: unknown }
): SessionInject {
  return {
    ...row,
    injects: normalizeInject(row.injects),
  };
}

async function getSessionInjectById(id: string): Promise<SessionInject | null> {
  const { data, error } = await supabase
    .from("session_injects")
    .select(
      `
        id,
        session_id,
        delivered_at,
        inject_id,
        injects:inject_id (
          id,
          title,
          body,
          channel,
          severity,
          sender_name,
          sender_org,
          inject_kind,
          source_type,
          entity_scope,
          requires_decision,
          decision_template_key,
          visibility_scope,
          branch_key
        )
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeSessionInjectRow(data as Omit<SessionInject, "injects"> & { injects: unknown }) : null;
}

function safeRemoveChannel(ch: unknown) {
  try {
    supabase.removeChannel(ch as never);
  } catch {
    // ignore
  }
}

/**
 * Realtime subscription with coalescing (debounce) to avoid UI thrash.
 * Multiple events within debounce window -> single cb() call.
 */
function debounceCoalesce(cb: () => void, debounceMs = 250) {
  let t: ReturnType<typeof setTimeout> | null = null;

  const fire = () => {
    if (t) return;
    t = setTimeout(() => {
      t = null;
      cb();
    }, debounceMs);
  };

  const cancel = () => {
    if (t) {
      clearTimeout(t);
      t = null;
    }
  };

  return { fire, cancel };
}

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
   SESSION META
========================= */

export async function getSessionScenarioId(sessionId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("scenario_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return ((data as { scenario_id?: string | null } | null)?.scenario_id ?? null) as
    | string
    | null;
}

/* =========================
   CREATE SESSION (seed from scenario)
========================= */

export async function createSessionFromScenario(params: {
  scenarioId: string;
  title: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_session_from_scenario", {
    p_scenario_id: params.scenarioId,
    p_title: params.title,
  });

  if (error) throw error;
  return data as string; // session_id
}

/* =========================
   INBOX (session_injects) – paginated
========================= */

type InboxOpts = {
  page?: number;
  pageSize?: number;

  channel?: string | null; // eq filter (injects.channel = ...)
  channelNot?: string | null; // neq filter (injects.channel <> ...)
  severity?: string | null; // eq filter (injects.severity = ...)
};

function selectSessionInjects() {
  // alias injects:inject_id must match FK on session_injects.inject_id -> injects.id
  return supabase
    .from("session_injects")
    .select(
      `
        id,
        session_id,
        delivered_at,
        inject_id,
        injects:inject_id (
          id,
          title,
          body,
          channel,
          severity,
          sender_name,
          sender_org,
          inject_kind,
          source_type,
          entity_scope,
          requires_decision,
          decision_template_key,
          visibility_scope,
          branch_key
        )
      `,
      { count: "exact" }
    );
}

export async function getSessionInbox(
  sessionId: string,
  opts: InboxOpts = {}
): Promise<PagedResult<SessionInject>> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, Math.min(50, opts.pageSize ?? 5));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = selectSessionInjects()
    .eq("session_id", sessionId)
    .order("delivered_at", { ascending: false });

  // Server-side filters on embedded resource
  if (opts.channel) q = q.eq("injects.channel", opts.channel);
  else if (opts.channelNot) q = q.neq("injects.channel", opts.channelNot);

  if (opts.severity) q = q.eq("injects.severity", opts.severity);

  const { data, error, count } = await q.range(from, to);

  if (error) throw error;

  return {
    items: (data ?? []).map(normalizeSessionInjectRow) as SessionInject[],
    total: count ?? 0,
    page,
  };
}

/**
 * Realtime subscription with coalescing (debounce) to avoid UI thrash.
 * - listens only to INSERT on session_injects (new delivered messages)
 * - multiple events within debounce window -> single cb() call
 */
export function subscribeInbox(sessionId: string, cb: () => void, debounceMs = 250) {
  const d = debounceCoalesce(cb, debounceMs);

  const ch = supabase
    // UNIQUE channel name for Inbox
    .channel(`session_injects:inbox:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "session_injects",
        filter: `session_id=eq.${sessionId}`,
      },
      () => d.fire()
    )
    .subscribe();

  return () => {
    d.cancel();
    safeRemoveChannel(ch);
  };
}

/* =========================
   PULSE
========================= */

export async function getSessionPulse(
  sessionId: string,
  opts: { page?: number; pageSize?: number; severity?: string | null } = {}
): Promise<PagedResult<PulseItem>> {
  return getSessionInbox(sessionId, {
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 5,
    channel: "pulse",
    severity: opts.severity ?? null,
  });
}

export function subscribePulse(sessionId: string, cb: () => void, debounceMs = 250) {
  const d = debounceCoalesce(cb, debounceMs);

  const ch = supabase
    // UNIQUE channel name for Pulse
    .channel(`session_injects:pulse:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "session_injects",
        filter: `session_id=eq.${sessionId}`,
      },
      () => d.fire()
    )
    .subscribe();

  return () => {
    d.cancel();
    safeRemoveChannel(ch);
  };
}

export function subscribeSessionInjectsPayload(
  sessionId: string,
  onInsert: (row: SessionInject) => void
) {
  const ch = supabase
    .channel(`session_injects:payload:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "session_injects",
        filter: `session_id=eq.${sessionId}`,
      },
      async (payload) => {
        try {
          const row = await getSessionInjectById((payload.new as { id: string }).id);
          if (row) onInsert(row);
        } catch {
          // ignore handler errors
        }
      }
    )
    .subscribe();

  return () => {
    safeRemoveChannel(ch);
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
    inject_kind?: Inject["inject_kind"];
    source_type?: Inject["source_type"];
    entity_scope?: string | null;
    requires_decision?: boolean;
    decision_template_key?: string | null;
    visibility_scope?: string | null;
    branch_key?: string | null;
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
      inject_kind: opts?.inject_kind ?? "system",
      source_type: opts?.source_type ?? "consequence",
      entity_scope: opts?.entity_scope ?? null,
      requires_decision: opts?.requires_decision ?? false,
      decision_template_key: opts?.decision_template_key ?? null,
      visibility_scope: opts?.visibility_scope ?? "all",
      branch_key: opts?.branch_key ?? null,
    })
    .select("id")
    .single();

  if (injErr) throw injErr;

  // 2) attach to session
  const { error: linkErr } = await supabase.from("session_injects").insert({
    session_id: sessionId,
    inject_id: (inj as { id: string }).id,
    delivered_at: new Date().toISOString(),
  });

  if (linkErr) throw linkErr;

  return (inj as { id: string }).id;
}

/* =========================
   FACILITATOR: deliverDueInjects (MVP)
========================= */

export async function deliverDueInjects(sessionId: string): Promise<{ delivered: number }> {
  const { data: sess, error: sessErr } = await supabase
    .from("sessions")
    .select("id, scenario_id")
    .eq("id", sessionId)
    .single();

  if (sessErr) throw sessErr;

  const scenarioId = (sess as { scenario_id?: string | null } | null)?.scenario_id;
  if (!scenarioId) return { delivered: 0 };

  const { data: due, error: dueErr } = await supabase
    .from("scenario_injects")
    .select("id, scenario_id, inject_id, scheduled_at")
    .eq("scenario_id", scenarioId)
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true });

  if (dueErr) throw dueErr;

  const dueRows = (due ?? []) as Array<{ inject_id: string }>;
  if (dueRows.length === 0) return { delivered: 0 };

  const injectIds = Array.from(new Set(dueRows.map((r) => r.inject_id)));

  const { data: already, error: alreadyErr } = await supabase
    .from("session_injects")
    .select("inject_id")
    .eq("session_id", sessionId)
    .in("inject_id", injectIds);

  if (alreadyErr) throw alreadyErr;

  const alreadySet = new Set((already ?? []).map((r) => r.inject_id));
  const toDeliver = dueRows.filter((r) => !alreadySet.has(r.inject_id));

  if (toDeliver.length === 0) return { delivered: 0 };

  const nowIso = new Date().toISOString();
  const inserts = toDeliver.map((r) => ({
    session_id: sessionId,
    inject_id: r.inject_id,
    delivered_at: nowIso,
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

/* =========================
   REALTIME: actions / situation / session meta
========================= */

export function subscribeActions(sessionId: string, cb: () => void, debounceMs = 250) {
  const d = debounceCoalesce(cb, debounceMs);

  const ch = supabase
    .channel(`session_actions:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "session_actions",
        filter: `session_id=eq.${sessionId}`,
      },
      () => d.fire()
    )
    .subscribe();

  return () => {
    d.cancel();
    safeRemoveChannel(ch);
  };
}

export function subscribeSituation(sessionId: string, cb: () => void, debounceMs = 250) {
  const d = debounceCoalesce(cb, debounceMs);

  const ch = supabase
    .channel(`session_situation:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "session_situation",
        filter: `session_id=eq.${sessionId}`,
      },
      () => d.fire()
    )
    .subscribe();

  return () => {
    d.cancel();
    safeRemoveChannel(ch);
  };
}

export function subscribeSessionMeta(sessionId: string, cb: () => void, debounceMs = 250) {
  const d = debounceCoalesce(cb, debounceMs);

  const ch = supabase
    .channel(`sessions:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "sessions",
        filter: `id=eq.${sessionId}`,
      },
      () => d.fire()
    )
    .subscribe();

  return () => {
    d.cancel();
    safeRemoveChannel(ch);
  };
}

/* =========================
   REALTIME (payload): no-refetch variants
   - keep existing subscribe* functions intact
========================= */

export function subscribeActionsPayload(
  sessionId: string,
  onInsert: (row: SessionAction) => void
) {
  const ch = supabase
    .channel(`session_actions:payload:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "session_actions",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        try {
          onInsert(payload.new as SessionAction);
        } catch {
          // ignore handler errors
        }
      }
    )
    .subscribe();

  return () => {
    safeRemoveChannel(ch);
  };
}

export function subscribeSituationPayload(
  sessionId: string,
  onUpsert: (row: SessionSituation) => void
) {
  const ch = supabase
    .channel(`session_situation:payload:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "*", // INSERT + UPDATE
        schema: "public",
        table: "session_situation",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        try {
          if (payload.new) onUpsert(payload.new as SessionSituation);
        } catch {
          // ignore handler errors
        }
      }
    )
    .subscribe();

  return () => {
    safeRemoveChannel(ch);
  };
}

export function subscribeSessionMetaPayload(
  sessionId: string,
  onUpdate: (row: unknown) => void
) {
  const ch = supabase
    .channel(`sessions:payload:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "sessions",
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
        try {
          if (payload.new) onUpdate(payload.new);
        } catch {
          // ignore handler errors
        }
      }
    )
    .subscribe();

  return () => {
    safeRemoveChannel(ch);
  };
}
