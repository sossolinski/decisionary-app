import { supabase } from "./supabaseClient";

export type SessionDecisionType = "ignore" | "escalate" | "act" | "confirm" | "deny";

export type SessionDecisionStatus =
  | "open"
  | "recorded"
  | "resolved"
  | "cancelled";

export type SessionTaskStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "done"
  | "cancelled";

export type SessionTaskPriority = "low" | "medium" | "high" | "critical";
export type ConsequenceSeverity = "low" | "medium" | "high" | "critical";

export type SessionDecision = {
  id: string;
  session_id: string;
  session_inject_id: string | null;
  action_id: string | null;
  owner_user_id: string | null;
  decision_type: SessionDecisionType;
  status: SessionDecisionStatus;
  due_at: string | null;
  rationale: string | null;
  outcome_code: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type SessionTask = {
  id: string;
  session_id: string;
  session_inject_id: string | null;
  decision_id: string | null;
  source_action_id: string | null;
  assigned_role: string | null;
  assigned_user_id: string | null;
  title: string;
  description: string | null;
  status: SessionTaskStatus;
  priority: SessionTaskPriority;
  due_at: string | null;
  started_at: string | null;
  resolved_at: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type SessionConsequence = {
  id: string;
  session_id: string;
  session_inject_id: string | null;
  decision_id: string | null;
  task_id: string | null;
  rule_template_id: string | null;
  consequence_type: string;
  severity: ConsequenceSeverity;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  applied_at: string;
  created_by: string | null;
};

export type RuntimeEvaluationResult = {
  created_consequences: number;
  created_tasks: number;
  created_injects: number;
};

function normalizeRuntimeEvaluationResult(value: unknown): RuntimeEvaluationResult {
  const row =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    created_consequences:
      typeof row.created_consequences === "number" ? row.created_consequences : 0,
    created_tasks: typeof row.created_tasks === "number" ? row.created_tasks : 0,
    created_injects: typeof row.created_injects === "number" ? row.created_injects : 0,
  };
}

export async function listSessionDecisions(sessionId: string, limit = 100) {
  const { data, error } = await supabase
    .from("session_decisions")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as SessionDecision[];
}

export async function createSessionDecision(params: {
  sessionId: string;
  sessionInjectId: string | null;
  actionId?: string | null;
  ownerUserId?: string | null;
  decisionType: SessionDecisionType;
  rationale?: string | null;
  outcomeCode?: string | null;
  status?: SessionDecisionStatus;
}) {
  const { data, error } = await supabase
    .from("session_decisions")
    .insert({
      session_id: params.sessionId,
      session_inject_id: params.sessionInjectId,
      action_id: params.actionId ?? null,
      owner_user_id: params.ownerUserId ?? null,
      decision_type: params.decisionType,
      status: params.status ?? "recorded",
      rationale: params.rationale ?? null,
      outcome_code: params.outcomeCode ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as SessionDecision;
}

export async function listSessionTasks(sessionId: string, limit = 100) {
  const { data, error } = await supabase
    .from("session_tasks")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as SessionTask[];
}

export async function createSessionTask(params: {
  sessionId: string;
  sessionInjectId?: string | null;
  decisionId?: string | null;
  sourceActionId?: string | null;
  assignedRole?: string | null;
  assignedUserId?: string | null;
  title: string;
  description?: string | null;
  status?: SessionTaskStatus;
  priority?: SessionTaskPriority;
  dueAt?: string | null;
}) {
  const { data, error } = await supabase
    .from("session_tasks")
    .insert({
      session_id: params.sessionId,
      session_inject_id: params.sessionInjectId ?? null,
      decision_id: params.decisionId ?? null,
      source_action_id: params.sourceActionId ?? null,
      assigned_role: params.assignedRole ?? null,
      assigned_user_id: params.assignedUserId ?? null,
      title: params.title,
      description: params.description ?? null,
      status: params.status ?? "open",
      priority: params.priority ?? "medium",
      due_at: params.dueAt ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as SessionTask;
}

export async function updateSessionTaskStatus(params: {
  taskId: string;
  status: SessionTaskStatus;
}) {
  const patch: Partial<SessionTask> & {
    started_at?: string | null;
    resolved_at?: string | null;
  } = {
    status: params.status,
  };

  if (params.status === "in_progress") patch.started_at = new Date().toISOString();
  if (params.status === "done") patch.resolved_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("session_tasks")
    .update(patch)
    .eq("id", params.taskId)
    .select("*")
    .single();

  if (error) throw error;
  return data as SessionTask;
}

export async function listSessionConsequences(sessionId: string, limit = 100) {
  const { data, error } = await supabase
    .from("session_consequences")
    .select("*")
    .eq("session_id", sessionId)
    .order("applied_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as SessionConsequence[];
}

export async function createSessionConsequenceIfMissing(params: {
  sessionId: string;
  sessionInjectId?: string | null;
  decisionId?: string | null;
  taskId?: string | null;
  ruleTemplateId?: string | null;
  consequenceType: string;
  severity?: ConsequenceSeverity;
  title: string;
  description?: string | null;
  payload?: Record<string, unknown>;
}) {
  let query = supabase
    .from("session_consequences")
    .select("*")
    .eq("session_id", params.sessionId)
    .eq("consequence_type", params.consequenceType)
    .eq("title", params.title)
    .limit(1);

  query =
    params.ruleTemplateId == null
      ? query.is("rule_template_id", null)
      : query.eq("rule_template_id", params.ruleTemplateId);
  query =
    params.sessionInjectId == null
      ? query.is("session_inject_id", null)
      : query.eq("session_inject_id", params.sessionInjectId);
  query =
    params.decisionId == null
      ? query.is("decision_id", null)
      : query.eq("decision_id", params.decisionId);
  query =
    params.taskId == null
      ? query.is("task_id", null)
      : query.eq("task_id", params.taskId);

  const { data: existing, error: existingError } = await query.maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    return { consequence: existing as SessionConsequence, created: false };
  }

  const { data, error } = await supabase
    .from("session_consequences")
    .insert({
      session_id: params.sessionId,
      session_inject_id: params.sessionInjectId ?? null,
      decision_id: params.decisionId ?? null,
      task_id: params.taskId ?? null,
      rule_template_id: params.ruleTemplateId ?? null,
      consequence_type: params.consequenceType,
      severity: params.severity ?? "medium",
      title: params.title,
      description: params.description ?? null,
      payload: params.payload ?? {},
    })
    .select("*")
    .single();

  if (error) throw error;
  return { consequence: data as SessionConsequence, created: true };
}

export async function evaluateSessionRules(params: {
  sessionId: string;
  eventType: "inject_released" | "decision_recorded" | "task_overdue";
  sessionInjectId?: string | null;
  decisionId?: string | null;
  actionId?: string | null;
  source?: "inbox" | "pulse" | null;
  taskId?: string | null;
}) {
  const { data, error } = await supabase.rpc("evaluate_session_rules", {
    p_session_id: params.sessionId,
    p_event_type: params.eventType,
    p_session_inject_id: params.sessionInjectId ?? null,
    p_decision_id: params.decisionId ?? null,
    p_action_id: params.actionId ?? null,
    p_source: params.source ?? null,
    p_task_id: params.taskId ?? null,
  });

  if (error) throw error;
  return normalizeRuntimeEvaluationResult(data);
}

export async function processOverdueSessionTasks(sessionId: string) {
  const { data, error } = await supabase.rpc("process_overdue_session_tasks", {
    p_session_id: sessionId,
  });

  if (error) throw error;
  return normalizeRuntimeEvaluationResult(data);
}

export function subscribeSessionConsequencesPayload(
  sessionId: string,
  onInsert: (row: SessionConsequence) => void
) {
  const ch = supabase
    .channel(`session_consequences:payload:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "session_consequences",
        filter: `session_id=eq.${sessionId}`,
      },
      (payload) => {
        try {
          onInsert(payload.new as SessionConsequence);
        } catch {
          // ignore handler errors
        }
      }
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(ch);
    } catch {
      // ignore
    }
  };
}
