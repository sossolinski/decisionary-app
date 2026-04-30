import { supabase } from "./supabaseClient";
import { attachSignedUrlsToInjects, type InjectMedia } from "./injectMedia";

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
  updated_at?: string; // optional (if not present in the schema)
};

export type Inject = {
  id: string;
  title: string | null;
  body: string | null;
  channel: string | null;
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

export type ScenarioInject = {
  id: string;
  scenario_id: string;
  inject_id: string;
  scheduled_at: string | null;
  release_offset_minutes: number | null;
  order_index: number;
  created_at: string;
  injects: Inject | null;
};

export type ScenarioRole = {
  id: string;
  scenario_id: string;
  role_key: string;
  role_name: string;
  role_description: string | null;
  sort_order: number;
  is_required: boolean;
  created_at: string;
};

export type ScenarioRuleTemplate = {
  id: string;
  scenario_id: string;
  rule_key: string;
  rule_name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  condition_config: Record<string, unknown>;
  effect_config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

/* =========================
   HELPERS
========================= */

// Supabase embed can come back as object OR array (depending on query shape / typing)
// Normalize to a single object for our ScenarioInject type.
function normalizeInject(v: unknown): Inject | null {
  if (!v) return null;
  const item = Array.isArray(v) ? (v[0] ?? null) : v;
  return item ? (item as Inject) : null;
}

function normalizeScenarioInjectRow(
  row: Omit<ScenarioInject, "injects"> & { injects: unknown }
): ScenarioInject {
  return {
    ...row,
    injects: normalizeInject(row.injects),
  };
}

async function hydrateScenarioInjectMedia(rows: ScenarioInject[]): Promise<ScenarioInject[]> {
  const injects = rows.map((row) => row.injects).filter(Boolean) as Inject[];
  if (injects.length === 0) return rows;

  const hydrated = await attachSignedUrlsToInjects(injects);
  const injectById = new Map(hydrated.map((inject) => [inject.id, inject]));

  return rows.map((row) => ({
    ...row,
    injects: row.injects ? injectById.get(row.injects.id) ?? row.injects : null,
  }));
}

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
  patch: Partial<Scenario>
): Promise<Scenario> {
  // IMPORTANT: do not touch updated_at if it does not exist in DB
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

export async function listScenarioInjects(
  scenarioId: string
): Promise<ScenarioInject[]> {
  const selectBase = `
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
  `;

  const withReleaseOffset = `
    id,
    scenario_id,
    inject_id,
    scheduled_at,
    release_offset_minutes,
    order_index,
    created_at,
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
  `;

  const runQuery = async (selectClause: string) =>
    supabase
      .from("scenario_injects")
      .select(selectClause)
      .eq("scenario_id", scenarioId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

  let { data, error } = await runQuery(withReleaseOffset);

  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (!message.includes("release_offset_minutes")) {
      throw error;
    }

    const fallback = await runQuery(selectBase);
    data = fallback.data;
    error = fallback.error;

    if (!error) {
      const normalized = ((data ?? []) as unknown as Array<
        Omit<ScenarioInject, "injects" | "release_offset_minutes"> & { injects: unknown }
      >).map((row) =>
        normalizeScenarioInjectRow({
          ...row,
          release_offset_minutes: null,
        })
      );
      return hydrateScenarioInjectMedia(normalized);
    }
  }

  if (error) throw error;

  return hydrateScenarioInjectMedia(
    ((data ?? []) as unknown as Array<Omit<ScenarioInject, "injects"> & { injects: unknown }>).map(
      normalizeScenarioInjectRow
    )
  );
}

export async function createInject(params: {
  title: string;
  body: string;
  channel?: string;
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
}): Promise<Inject> {
  const { data, error } = await supabase
    .from("injects")
    .insert({
      title: params.title,
      body: params.body,
      channel: params.channel === "pulse" ? "pulse" : "inbox",
      severity: params.severity ?? null,
      sender_name: params.sender_name ?? "Facilitator",
      sender_org: params.sender_org ?? "Decisionary",
      inject_kind: params.inject_kind ?? "operational",
      source_type: params.source_type ?? "manual",
      entity_scope: params.entity_scope ?? null,
      requires_decision: params.requires_decision ?? false,
      decision_template_key: params.decision_template_key ?? null,
      visibility_scope: params.visibility_scope ?? "all",
      branch_key: params.branch_key ?? null,
    })
    .select("id, title, body, channel, severity, sender_name, sender_org, inject_kind, source_type, entity_scope, requires_decision, decision_template_key, visibility_scope, branch_key, created_at")
    .single();

  if (error) throw error;
  const [inject] = await attachSignedUrlsToInjects([data as Inject]);
  return inject;
}

export async function attachInjectToScenario(params: {
  scenarioId: string;
  injectId: string;
  scheduled_at?: string | null;
  release_offset_minutes?: number | null;
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
      release_offset_minutes: params.release_offset_minutes ?? null,
      order_index: nextOrder,
    })
    .select(
      `
        id,
        scenario_id,
        inject_id,
        scheduled_at,
        release_offset_minutes,
        order_index,
        created_at,
        injects:inject_id (
          id, title, body, channel, severity, sender_name, sender_org, inject_kind, source_type, entity_scope, requires_decision, decision_template_key, visibility_scope, branch_key,
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
    .single();

  if (error) throw error;

  // ✅ normalize injects embed
  return hydrateScenarioInjectMedia([normalizeScenarioInjectRow(data)]).then((rows) => rows[0]);
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
  release_offset_minutes?: number | null;
  order_index?: number;
}): Promise<void> {
  const patch: Record<string, unknown> = {};
  if ("scheduled_at" in params) patch.scheduled_at = params.scheduled_at ?? null;
  if ("release_offset_minutes" in params) patch.release_offset_minutes = params.release_offset_minutes ?? null;
  if ("order_index" in params) patch.order_index = params.order_index;

  const { error } = await supabase
    .from("scenario_injects")
    .update(patch)
    .eq("id", params.id);

  if (error) throw error;
}

/* =========================
   SCENARIO RULE TEMPLATES
========================= */

export async function listScenarioRuleTemplates(
  scenarioId: string
): Promise<ScenarioRuleTemplate[]> {
  const { data, error } = await supabase
    .from("scenario_rule_templates")
    .select("*")
    .eq("scenario_id", scenarioId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ScenarioRuleTemplate[];
}

export async function createScenarioRuleTemplate(params: {
  scenarioId: string;
  ruleKey: string;
  ruleName: string;
  description?: string | null;
  triggerType: string;
  triggerConfig?: Record<string, unknown>;
  conditionConfig?: Record<string, unknown>;
  effectConfig?: Record<string, unknown>;
  enabled?: boolean;
}): Promise<ScenarioRuleTemplate> {
  const { data, error } = await supabase
    .from("scenario_rule_templates")
    .insert({
      scenario_id: params.scenarioId,
      rule_key: params.ruleKey.trim(),
      rule_name: params.ruleName.trim(),
      description: params.description ?? null,
      trigger_type: params.triggerType.trim(),
      trigger_config: params.triggerConfig ?? {},
      condition_config: params.conditionConfig ?? {},
      effect_config: params.effectConfig ?? {},
      enabled: params.enabled ?? true,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as ScenarioRuleTemplate;
}

export async function updateScenarioRuleTemplate(params: {
  id: string;
  ruleKey?: string;
  ruleName?: string;
  description?: string | null;
  triggerType?: string;
  triggerConfig?: Record<string, unknown>;
  conditionConfig?: Record<string, unknown>;
  effectConfig?: Record<string, unknown>;
  enabled?: boolean;
}): Promise<ScenarioRuleTemplate> {
  const { id, ...patch } = params;
  const update: Record<string, unknown> = {};

  if (patch.ruleKey !== undefined) update.rule_key = patch.ruleKey.trim();
  if (patch.ruleName !== undefined) update.rule_name = patch.ruleName.trim();
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.triggerType !== undefined) update.trigger_type = patch.triggerType.trim();
  if (patch.triggerConfig !== undefined) update.trigger_config = patch.triggerConfig;
  if (patch.conditionConfig !== undefined) update.condition_config = patch.conditionConfig;
  if (patch.effectConfig !== undefined) update.effect_config = patch.effectConfig;
  if (patch.enabled !== undefined) update.enabled = patch.enabled;

  const { data, error } = await supabase
    .from("scenario_rule_templates")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as ScenarioRuleTemplate;
}

export async function deleteScenarioRuleTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("scenario_rule_templates")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/* =========================
   SCENARIO ROLES (CRUD)
========================= */

export async function listScenarioRoles(scenarioId: string): Promise<ScenarioRole[]> {
  const { data, error } = await supabase
    .from("scenario_roles")
    .select("*")
    .eq("scenario_id", scenarioId)
    .order("sort_order", { ascending: true })
    .order("role_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ScenarioRole[];
}

export async function createScenarioRole(params: {
  scenarioId: string;
  roleKey: string;
  roleName: string;
  roleDescription?: string | null;
  sortOrder?: number;
  isRequired?: boolean;
}): Promise<ScenarioRole> {
  const { scenarioId, roleKey, roleName, roleDescription, sortOrder, isRequired } = params;

  const { data, error } = await supabase
    .from("scenario_roles")
    .insert({
      scenario_id: scenarioId,
      role_key: roleKey.trim(),
      role_name: roleName.trim(),
      role_description: roleDescription ?? null,
      sort_order: sortOrder ?? 100,
      is_required: isRequired ?? true,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as ScenarioRole;
}

export async function updateScenarioRole(params: {
  id: string;
  roleKey?: string;
  roleName?: string;
  roleDescription?: string | null;
  sortOrder?: number;
  isRequired?: boolean;
}): Promise<ScenarioRole> {
  const { id, ...patch } = params;

  const update: Record<string, unknown> = {};
  if (patch.roleKey !== undefined) update.role_key = patch.roleKey.trim();
  if (patch.roleName !== undefined) update.role_name = patch.roleName.trim();
  if (patch.roleDescription !== undefined) update.role_description = patch.roleDescription;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  if (patch.isRequired !== undefined) update.is_required = patch.isRequired;

  const { data, error } = await supabase
    .from("scenario_roles")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as ScenarioRole;
}

export async function deleteScenarioRole(id: string): Promise<void> {
  const { error } = await supabase.from("scenario_roles").delete().eq("id", id);
  if (error) throw error;
}
