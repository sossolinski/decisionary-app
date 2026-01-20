import { supabase } from "./supabaseClient";

/* =========================
   TYPES
========================= */

export type Scenario = {
  id: string;
  owner_id: string | null;
  title: string;
  description: string | null;

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

  created_at: string;
  // updated_at may NOT exist in your schema (keep it optional)
  updated_at?: string;
};

export type Inject = {
  id: string;
  title: string | null;
  body: string | null;
  channel: string | null;
  severity: string | null;
  sender_name: string | null;
  sender_org: string | null;
  created_at?: string;
};

export type ScenarioInject = {
  id: string;
  scenario_id: string;
  inject_id: string;
  scheduled_at: string | null;
  order_index: number;
  created_at: string;
  injects: Inject | null;
};

/* =========================
   SCENARIO CRUD
========================= */

export async function getScenario(id: string): Promise<Scenario | null> {
  const { data, error } = await supabase
    .from("scenarios")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as Scenario) ?? null;
}

export async function updateScenario(
  id: string,
  patch: Partial<Omit<Scenario, "id" | "created_at" | "updated_at">>
): Promise<Scenario> {
  // IMPORTANT: do NOT write updated_at (not present in your DB)
  const { data, error } = await supabase
    .from("scenarios")
    .update({ ...patch })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Scenario;
}

/* =========================
   INJECTS FOR SCENARIO
========================= */

export async function listScenarioInjects(scenarioId: string): Promise<ScenarioInject[]> {
  const { data, error } = await supabase
    .from("scenario_injects")
    .select(
      `
      id,
      scenario_id,
      inject_id,
      scheduled_at,
      order_index,
      created_at,
      injects:inject_id (
        id,
        title,
        body,
        channel,
        severity,
        sender_name,
        sender_org
      )
    `
    )
    .eq("scenario_id", scenarioId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ScenarioInject[];
}

export async function createInject(params: {
  title: string;
  body: string;
  channel?: string;
  severity?: string | null;
  sender_name?: string | null;
  sender_org?: string | null;
}): Promise<Inject> {
  const { data, error } = await supabase
    .from("injects")
    .insert({
      title: params.title,
      body: params.body,
      channel: params.channel ?? "ops",
      severity: params.severity ?? null,
      sender_name: params.sender_name ?? "Facilitator",
      sender_org: params.sender_org ?? "Decisionary",
    })
    .select(
      "id, title, body, channel, severity, sender_name, sender_org, created_at"
    )
    .single();

  if (error) throw error;
  return data as Inject;
}

export async function attachInjectToScenario(params: {
  scenarioId: string;
  injectId: string;
  scheduled_at?: string | null;
}): Promise<ScenarioInject> {
  // compute next order_index
  const { data: existing, error: exErr } = await supabase
    .from("scenario_injects")
    .select("order_index")
    .eq("scenario_id", params.scenarioId)
    .order("order_index", { ascending: false })
    .limit(1);

  if (exErr) throw exErr;
  const maxOrder = (existing?.[0]?.order_index ?? 0) as number;
  const nextOrder = maxOrder + 1;

  const { data, error } = await supabase
    .from("scenario_injects")
    .insert({
      scenario_id: params.scenarioId,
      inject_id: params.injectId,
      scheduled_at: params.scheduled_at ?? null,
      order_index: nextOrder,
    })
    .select(
      `
      id,
      scenario_id,
      inject_id,
      scheduled_at,
      order_index,
      created_at,
      injects:inject_id (
        id,
        title,
        body,
        channel,
        severity,
        sender_name,
        sender_org
      )
    `
    )
    .single();

  if (error) throw error;
  return data as ScenarioInject;
}

export async function detachScenarioInject(scenarioInjectId: string) {
  const { error } = await supabase
    .from("scenario_injects")
    .delete()
    .eq("id", scenarioInjectId);

  if (error) throw error;
}

export async function updateScenarioInject(params: {
  id: string;
  scheduled_at?: string | null;
  order_index?: number;
}): Promise<void> {
  const patch: any = {};
  if ("scheduled_at" in params) patch.scheduled_at = params.scheduled_at ?? null;
  if ("order_index" in params) patch.order_index = params.order_index;

  const { error } = await supabase
    .from("scenario_injects")
    .update(patch)
    .eq("id", params.id);

  if (error) throw error;
}
