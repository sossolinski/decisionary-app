// lib/sessions.ts
import { supabase } from "./supabaseClient";
import {
  attachSignedUrlsToInjects,
  type InjectMedia,
  type PendingInjectMedia,
  uploadInjectMediaFiles,
} from "./injectMedia";

/* =========================
   TYPES
========================= */

export type SessionSituation = {
  session_id: string;

  event_date: string | null;
  event_time: string | null;
  timezone: string | null;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  weather: string | null;

  situation_type: string | null;
  short_description: string | null;

  injured: number;
  fatalities: number;
  uninjured: number;
  unknown: number;
  passenger_count: number;
  crew_count: number;
  cargo_weight_kg: number;
  dangerous_goods_count: number;
  live_animals_count: number;

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
  media?: InjectMedia[] | null;
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
  inject_title?: string | null;
  inject_channel?: string | null;
  inject_sender_name?: string | null;
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

async function hydrateSessionInjectMedia(rows: SessionInject[]): Promise<SessionInject[]> {
  const injects = rows.map((row) => row.injects).filter(Boolean) as Inject[];
  if (injects.length === 0) return rows;

  const hydrated = await attachSignedUrlsToInjects(injects);
  const injectById = new Map(hydrated.map((inject) => [inject.id, inject]));

  return rows.map((row) => ({
    ...row,
    injects: row.injects ? injectById.get(row.injects.id) ?? row.injects : null,
  }));
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
        injects:inject_id!inner (
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
          branch_key,
          media:inject_media (
            id,
            inject_id,
            storage_path,
            mime_type,
            width,
            height,
            alt_text,
            sort_order,
            created_at
          )
        )
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const [row] = await hydrateSessionInjectMedia([
    normalizeSessionInjectRow(data as Omit<SessionInject, "injects"> & { injects: unknown }),
  ]);
  return row;
}

function normalizeSessionActionRow(
  row: SessionAction & {
    session_injects?: {
      injects?: {
        title?: string | null;
        channel?: string | null;
        sender_name?: string | null;
      } | null;
    } | null;
  }
): SessionAction {
  return {
    id: row.id,
    session_id: row.session_id,
    session_inject_id: row.session_inject_id,
    source: row.source,
    action_type: row.action_type,
    comment: row.comment,
    created_at: row.created_at,
    inject_title: row.session_injects?.injects?.title ?? null,
    inject_channel: row.session_injects?.injects?.channel ?? null,
    inject_sender_name: row.session_injects?.injects?.sender_name ?? null,
  };
}

async function getSessionActionById(id: string): Promise<SessionAction | null> {
  const { data, error } = await supabase
    .from("session_actions")
    .select(
      `
        id,
        session_id,
        session_inject_id,
        source,
        action_type,
        comment,
        created_at,
        session_injects:session_inject_id (
          injects:inject_id (
            title,
            channel,
            sender_name
          )
        )
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return normalizeSessionActionRow(
    data as SessionAction & {
      session_injects?: {
        injects?: {
          title?: string | null;
          channel?: string | null;
          sender_name?: string | null;
        } | null;
      } | null;
    }
  );
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
  const { data, error } = await supabase.rpc("create_rehearsal_session_from_scenario", {
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
  search?: string | null;
};

function escapeIlikeTerm(value: string) {
  return value.replace(/[%_]/g, "\\$&").trim();
}

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
        injects:inject_id!inner (
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
          branch_key,
          media:inject_media (
            id,
            inject_id,
            storage_path,
            mime_type,
            width,
            height,
            alt_text,
            sort_order,
            created_at
          )
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

  // Feeds should show incoming content, not internal/system follow-ups.
  q = q
    .neq("injects.source_type", "conditional")
    .neq("injects.source_type", "consequence");

  // Server-side filters on embedded resource
  if (opts.channel) q = q.eq("injects.channel", opts.channel);
  else if (opts.channelNot) q = q.neq("injects.channel", opts.channelNot);

  if (opts.severity) q = q.eq("injects.severity", opts.severity);

  if (opts.search?.trim()) {
    const term = escapeIlikeTerm(opts.search);
    if (term) {
      q = q.or(
        `title.ilike.%${term}%,body.ilike.%${term}%,sender_name.ilike.%${term}%,sender_org.ilike.%${term}%`,
        { foreignTable: "injects" }
      );
    }
  }

  const { data, error, count } = await q.range(from, to);

  if (error) throw error;

  const rows = await hydrateSessionInjectMedia((data ?? []).map(normalizeSessionInjectRow) as SessionInject[]);

  return {
    items: rows,
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
  opts: { page?: number; pageSize?: number; severity?: string | null; search?: string | null } = {}
): Promise<PagedResult<PulseItem>> {
  return getSessionInbox(sessionId, {
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 5,
    channel: "pulse",
    severity: opts.severity ?? null,
    search: opts.search ?? null,
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
    .select(
      `
        id,
        session_id,
        session_inject_id,
        source,
        action_type,
        comment,
        created_at,
        session_injects:session_inject_id (
          injects:inject_id (
            title,
            channel,
            sender_name
          )
        )
      `
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as Array<
    SessionAction & {
      session_injects?: {
        injects?: {
          title?: string | null;
          channel?: string | null;
          sender_name?: string | null;
        } | null;
      } | null;
    }
  >).map(normalizeSessionActionRow);
}

export async function addSessionAction(params: {
  sessionId: string;
  sessionInjectId: string | null;
  source: "inbox" | "pulse";
  actionType: "ignore" | "escalate" | "act";
  comment: string | null;
}) {
  const { sessionId, sessionInjectId, source, actionType, comment } = params;

  const { data, error } = await supabase.rpc("record_session_action", {
    p_session_id: sessionId,
    p_session_inject_id: sessionInjectId,
    p_source: source,
    p_action_type: actionType,
    p_comment: comment,
  });

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
    channel?: string; // default "inbox"
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
    media_files?: PendingInjectMedia[];
  }
) {
  const channel = opts?.channel === "pulse" ? "pulse" : "inbox";
  let injectId: string | null = null;

  try {
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
        source_type: opts?.source_type ?? "manual",
        entity_scope: opts?.entity_scope ?? null,
        requires_decision: opts?.requires_decision ?? false,
        decision_template_key: opts?.decision_template_key ?? null,
        visibility_scope: opts?.visibility_scope ?? "all",
        branch_key: opts?.branch_key ?? null,
      })
      .select("id")
      .single();

    if (injErr) throw injErr;
    injectId = (inj as { id: string }).id;

    if ((opts?.media_files?.length ?? 0) > 0) {
      await uploadInjectMediaFiles({
        injectId,
        files: opts?.media_files ?? [],
        altTextBase: title,
      });
    }

    const { error: linkErr } = await supabase.rpc("release_session_inject", {
      p_session_id: sessionId,
      p_inject_id: injectId,
      p_delivered_at: new Date().toISOString(),
    });

    if (linkErr) throw linkErr;

    return injectId;
  } catch (error) {
    if (injectId) {
      await supabase.from("injects").delete().eq("id", injectId);
    }
    throw error;
  }
}

/* =========================
   FACILITATOR: deliverDueInjects (MVP)
========================= */

export async function deliverDueInjects(sessionId: string): Promise<{ delivered: number }> {
  const { data: sess, error: sessErr } = await supabase
    .from("sessions")
    .select("id, scenario_id, status, started_at")
    .eq("id", sessionId)
    .single();

  if (sessErr) throw sessErr;

  const scenarioId = (sess as { scenario_id?: string | null } | null)?.scenario_id;
  const sessionStatus = (sess as { status?: string | null } | null)?.status;
  const sessionStartedAt = (sess as { started_at?: string | null } | null)?.started_at;
  if (!scenarioId || sessionStatus !== "live" || !sessionStartedAt) return { delivered: 0 };

  const { data: due, error: dueErr } = await supabase
    .from("scenario_injects")
    .select("id, scenario_id, inject_id, scheduled_at, release_offset_minutes")
    .eq("scenario_id", scenarioId)
    .order("order_index", { ascending: true });

  if (dueErr) throw dueErr;

  const startedAtMs = new Date(sessionStartedAt).getTime();
  const nowMs = Date.now();
  const dueRows = ((due ?? []) as Array<{
    inject_id: string;
    scheduled_at?: string | null;
    release_offset_minutes?: number | null;
  }>).filter((row) => {
    if (typeof row.release_offset_minutes === "number") {
      return startedAtMs + row.release_offset_minutes * 60_000 <= nowMs;
    }

    if (row.scheduled_at) {
      const scheduledAtMs = new Date(row.scheduled_at).getTime();
      return Number.isFinite(scheduledAtMs) && scheduledAtMs <= nowMs;
    }

    return true;
  });
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
  for (const row of toDeliver) {
    const { error: releaseErr } = await supabase.rpc("release_session_inject", {
      p_session_id: sessionId,
      p_inject_id: row.inject_id,
      p_delivered_at: nowIso,
    });
    if (releaseErr) throw releaseErr;
  }

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

  const { data, error } = await supabase.rpc("update_session_casualties", {
    p_session_id: sessionId,
    p_injured: injured,
    p_fatalities: fatalities,
    p_uninjured: uninjured,
    p_unknown: unknown,
  });

  if (error) throw error;
  return data as SessionSituation;
}

export async function updateSessionManifest(params: {
  sessionId: string;
  passengerCount: number;
  crewCount: number;
  cargoWeightKg: number;
  dangerousGoodsCount: number;
  liveAnimalsCount: number;
}) {
  const { sessionId, passengerCount, crewCount, cargoWeightKg, dangerousGoodsCount, liveAnimalsCount } = params;

  const { data, error } = await supabase.rpc("update_session_manifest", {
    p_session_id: sessionId,
    p_passenger_count: passengerCount,
    p_crew_count: crewCount,
    p_cargo_weight_kg: cargoWeightKg,
    p_dangerous_goods_count: dangerousGoodsCount,
    p_live_animals_count: liveAnimalsCount,
  });

  if (error) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("session_situation")
      .update({
        passenger_count: passengerCount,
        crew_count: crewCount,
        cargo_weight_kg: cargoWeightKg,
        dangerous_goods_count: dangerousGoodsCount,
        live_animals_count: liveAnimalsCount,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .select("*")
      .single();

    if (fallbackError) throw fallbackError;
    return fallbackData as SessionSituation;
  }
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
      async (payload) => {
        try {
          const row = await getSessionActionById((payload.new as { id: string }).id);
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
