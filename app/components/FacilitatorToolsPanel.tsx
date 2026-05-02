"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { deliverDueInjects, sendInjectToSession } from "@/lib/sessions";
import { createPendingInjectMedia, type PendingInjectMedia } from "@/lib/injectMedia";
import useAutoRefresh from "@/app/components/useAutoRefresh";
import {
  listScenarioInjects,
  listScenarioRuleTemplates,
  type ScenarioInject,
} from "@/lib/scenarios";
import { getErrorMessage } from "@/lib/errors";
import { copyTextToClipboard } from "@/lib/clientClipboard";
import { normalizeSessionStatus } from "@/lib/sessionStatus";
import { validateMessagePayload } from "@/lib/validators";
import {
  evaluateSessionRules,
  listSessionConsequences,
  listSessionRuleEvaluations,
  listSessionTasks,
  processOverdueSessionTasks,
  type SessionConsequence,
  type SessionRuleEvaluation,
  type SessionTask,
} from "@/lib/sessionEngine";
import {
  listSessionParticipantActivity,
  type SessionParticipantActivityRow,
} from "@/lib/sessionsRuntime";
import { Button } from "@/app/components/ui/button";
import InjectMediaField from "@/app/components/InjectMediaField";
import { Input } from "@/app/components/ui/input";
import Collapsible from "@/app/components/Collapsible";
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  PlayCircle,
  Radio,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  TimerReset,
  Users,
  Zap,
} from "lucide-react";
import { RULE_PRESETS } from "@/app/components/facilitator-scenarios/scenarioEditorUi";

type SessionMeta = {
  status: string | null;
  join_code: string | null;
  started_at: string | null;
  ended_at: string | null;
  scenario_id: string | null;
};

function fmtIso(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

function fmtShort(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function getParticipantState(row: SessionParticipantActivityRow) {
  const lastActivityTime = row.last_activity_at ? new Date(row.last_activity_at).getTime() : null;
  const activeRecently =
    typeof lastActivityTime === "number" &&
    Number.isFinite(lastActivityTime) &&
    Date.now() - lastActivityTime <= 15 * 60 * 1000;

  if (row.completed_task_count > 0) {
    return {
      label: "Tasks done",
      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
    };
  }

  if (row.task_updates_count > 0) {
    return {
      label: "Task progress",
      className:
        "border-sky-500/20 bg-sky-500/10 text-sky-700",
    };
  }

  if (activeRecently || row.response_count > 0) {
    return {
      label: activeRecently ? "Active recently" : "Responded",
      className:
        "border-violet-500/20 bg-violet-500/10 text-violet-700",
    };
  }

  if (row.joined_at) {
    return {
      label: "Waiting",
      className:
        "border-amber-500/20 bg-amber-500/10 text-amber-700",
    };
  }

  return {
    label: "Not joined",
    className:
      "border-[var(--studio-border)] bg-[color:var(--studio-surface2)] text-muted-foreground",
  };
}

function humanizeTraceReason(reason: string | null | undefined) {
  if (!reason) return null;
  return reason.replaceAll(".", " -> ").replaceAll("_", " ");
}

function formatInjectReleaseOffset(minutes: number | null | undefined) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
    return "immediate";
  }
  return `T+${Math.round(minutes)}m`;
}

function normalizeStream(channel: string | null | undefined) {
  return String(channel ?? "").toLowerCase() === "pulse" ? "pulse" : "inbox";
}

function readContextValue(
  context: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = context?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function describeEvaluationFocus(row: SessionRuleEvaluation) {
  const injectTitle = readContextValue(row.context, "inject_title");
  if (injectTitle) return injectTitle;

  const taskTitle = readContextValue(row.context, "task_title");
  if (taskTitle) return taskTitle;

  const decisionType = readContextValue(row.context, "decision_type");
  if (decisionType) return `Decision: ${decisionType.replaceAll("_", " ")}`;

  const actionType = readContextValue(row.context, "action_type");
  if (actionType) return `Action: ${actionType.replaceAll("_", " ")}`;

  return null;
}

function summarizeEvaluation(row: SessionRuleEvaluation) {
  const parts = [
    row.matched ? "matched" : "skipped",
    row.created_consequence_count > 0 ? `${row.created_consequence_count} consequences` : null,
    row.created_task_count > 0 ? `${row.created_task_count} tasks` : null,
    row.created_inject_count > 0 ? `${row.created_inject_count} injects` : null,
    !row.matched && row.skip_reason ? humanizeTraceReason(row.skip_reason) : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "No trace details recorded";
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--card))] px-2.5 py-1 text-xs font-semibold text-[color:var(--studio-ink)]">
      {children}
    </span>
  );
}

function ToolMetric({
  icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-500/35 text-red-700 dark:text-red-200"
      : tone === "warning"
        ? "border-amber-500/35 text-amber-800 dark:text-amber-200"
        : tone === "success"
          ? "border-emerald-500/35 text-emerald-700 dark:text-emerald-200"
          : "border-[var(--studio-border)] text-[color:var(--studio-ink)]";

  return (
    <div className={`min-h-[50px] rounded-[8px] border bg-[hsl(var(--background))] px-2.5 py-2 ${toneClass}`}>
      <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] opacity-70 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:stroke-[1.8]">
        <span className="shrink-0 opacity-80">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 flex min-w-0 items-baseline justify-between gap-2">
        <span className="truncate text-base font-semibold leading-none">{value}</span>
        {hint ? <span className="truncate text-xs font-semibold opacity-65">{hint}</span> : null}
      </div>
    </div>
  );
}

function ToolSectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-[color:var(--studio-muted2)] [&_svg]:h-4 [&_svg]:w-4 [&_svg]:stroke-[1.8]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold leading-none text-[color:var(--studio-ink)]">{title}</div>
        {subtitle ? (
          <div className="mt-1 truncate text-xs font-semibold text-[color:var(--studio-muted2)]">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border border-dashed border-[var(--studio-border)] bg-[hsl(var(--background))] px-3 py-4 text-sm text-[color:var(--studio-muted2)]">
      {children}
    </div>
  );
}

function Select({
  id,
  value,
  onChange,
  disabled = false,
  children,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-10 w-full rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 text-sm font-semibold text-foreground focus-visible:shadow-[var(--studio-ring)] focus-visible:outline-none"
    >
      {children}
    </select>
  );
}

export default function FacilitatorToolsPanel({
  sessionId,
  scenarioId,
  compact = false,
  onSessionMetaChange,
}: {
  sessionId: string;
  scenarioId: string | null;
  compact?: boolean;
  onSessionMetaChange?: (meta: SessionMeta | null) => void;
}) {
  const formId = useId();
  const [meta, setMeta] = useState<SessionMeta | null>(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [engineRefreshing, setEngineRefreshing] = useState(false);
  const [joinCodeCopied, setJoinCodeCopied] = useState(false);

  // collapsibles
  const [injectReleaseOpen, setInjectReleaseOpen] = useState(false);
  const [participantDetailsOpen, setParticipantDetailsOpen] = useState(false);
  const [quickMsgOpen, setQuickMsgOpen] = useState(false);
  const [quickAdvancedOpen, setQuickAdvancedOpen] = useState(false);
  const [runtimeDetailOpen, setRuntimeDetailOpen] = useState(false);
  const [latestInsightsOpen, setLatestInsightsOpen] = useState(false);
  const [traceHistoryOpen, setTraceHistoryOpen] = useState(false);

  // Scenario inject library
  const [scenarioInjects, setScenarioInjects] = useState<ScenarioInject[]>([]);
  const [deliveredIds, setDeliveredIds] = useState<Set<string>>(new Set());
  const [selectedSiId, setSelectedSiId] = useState<string>("");

  // Quick message (ad-hoc) — consistent fields
  const [qmTitle, setQmTitle] = useState("");
  const [qmBody, setQmBody] = useState("");
  const [qmChannel, setQmChannel] = useState("inbox");
  const [qmSeverity, setQmSeverity] = useState<string>("");
  const [qmSender, setQmSender] = useState("Facilitator");
  const [qmRequiresDecision, setQmRequiresDecision] = useState(false);
  const [qmDecisionTemplateKey, setQmDecisionTemplateKey] = useState("");
  const [qmMediaFiles, setQmMediaFiles] = useState<PendingInjectMedia[]>([]);

  const [taskRows, setTaskRows] = useState<SessionTask[]>([]);
  const [consequenceRows, setConsequenceRows] = useState<SessionConsequence[]>([]);
  const [evaluationRows, setEvaluationRows] = useState<SessionRuleEvaluation[]>([]);
  const [manualRuleCount, setManualRuleCount] = useState(0);
  const [participantRows, setParticipantRows] = useState<SessionParticipantActivityRow[]>([]);

  const effectiveScenarioId = scenarioId ?? meta?.scenario_id ?? null;
  const sessionLive = meta?.status === "live";
  const quickTitleId = `${formId}-quick-title`;
  const quickStreamId = `${formId}-quick-stream`;
  const quickBodyId = `${formId}-quick-body`;
  const quickSeverityId = `${formId}-quick-severity`;
  const quickSenderId = `${formId}-quick-sender`;
  const quickDecisionRequiredId = `${formId}-quick-decision-required`;
  const quickDecisionTemplateId = `${formId}-quick-decision-template`;

  async function refreshMeta() {
    const { data, error } = await supabase
      .from("sessions")
      .select("status, join_code, started_at, ended_at, scenario_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (!error) {
      const nextMeta = (data ?? null) as SessionMeta | null;
      setMeta(nextMeta);
      onSessionMetaChange?.(nextMeta);
    }
  }

  async function refreshInjectLibrary() {
    if (!effectiveScenarioId) {
      setScenarioInjects([]);
      setDeliveredIds(new Set());
      setSelectedSiId("");
      return;
    }

    const si = await listScenarioInjects(effectiveScenarioId);
    setScenarioInjects(si ?? []);

    const injectIds = Array.from(
      new Set((si ?? []).map((x) => x.inject_id).filter(Boolean))
    );
    if (injectIds.length === 0) {
      setDeliveredIds(new Set());
      setSelectedSiId("");
      return;
    }

    // delivered inject_id in this session
    const { data: delivered, error } = await supabase
      .from("session_injects")
      .select("inject_id")
      .eq("session_id", sessionId);

    if (error) {
      setDeliveredIds(new Set());
      return;
    }

    const set = new Set<string>(
      (delivered ?? [])
        .map((r) => r.inject_id)
        .filter((v): v is string => typeof v === "string" && Boolean(v))
    );
    setDeliveredIds(set);

    // default to first pending
    const firstPending = (si ?? []).find((x) => x?.inject_id && !set.has(x.inject_id));
    setSelectedSiId(firstPending?.id ?? "");
  }

  async function refreshRuleTemplates() {
    if (!effectiveScenarioId) {
      setManualRuleCount(0);
      return;
    }

    const rules = await listScenarioRuleTemplates(effectiveScenarioId);
    setManualRuleCount(
      rules.filter((rule) => rule.enabled && rule.trigger_type === "manual").length
    );
  }

  async function refreshEngineState() {
    const [tasks, consequences, evaluations] = await Promise.all([
      listSessionTasks(sessionId, 100),
      listSessionConsequences(sessionId, 100),
      listSessionRuleEvaluations(sessionId, 25),
    ]);
    setTaskRows(tasks);
    setConsequenceRows(consequences);
    setEvaluationRows(evaluations);
  }

  async function refreshParticipantActivity() {
    const rows = await listSessionParticipantActivity(sessionId);
    setParticipantRows(rows);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refreshMeta();
        if (!alive) return;
        await refreshInjectLibrary();
        if (!alive) return;
        await refreshRuleTemplates();
        if (!alive) return;
        await refreshEngineState();
        if (!alive) return;
        await refreshParticipantActivity();
      } catch {
        // soft fail
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, effectiveScenarioId]);

  useAutoRefresh(
    async () => {
      await refreshParticipantActivity();
    },
    { enabled: Boolean(sessionId), intervalMs: 20000 }
  );

  const pending = useMemo(() => {
    return (scenarioInjects ?? []).filter(
      (x) => x.inject_id && !deliveredIds.has(x.inject_id)
    );
  }, [scenarioInjects, deliveredIds]);

  const selectedSI = useMemo(() => {
    return (scenarioInjects ?? []).find((x) => x.id === selectedSiId) ?? null;
  }, [scenarioInjects, selectedSiId]);

  const decisionTemplateOptions = useMemo(() => {
    const scenarioKeys = scenarioInjects
      .map((row) => row.injects?.decision_template_key?.trim())
      .filter((value): value is string => Boolean(value));

    const presetKeys = RULE_PRESETS.map((preset) => {
      const effectConfig = preset.effectConfig as {
        send_inject?: { decision_template_key?: string };
      };
      return effectConfig.send_inject?.decision_template_key?.trim() ?? null;
    }).filter((value): value is string => Boolean(value));

    return Array.from(new Set([...scenarioKeys, ...presetKeys])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [scenarioInjects]);

  const openTasks = useMemo(
    () => taskRows.filter((task) => task.status !== "done" && task.status !== "cancelled"),
    [taskRows]
  );

  const overdueTasks = useMemo(() => {
    const now = Date.now();
    return openTasks.filter((task) => {
      if (!task.due_at) return false;
      const dueAt = new Date(task.due_at).getTime();
      return Number.isFinite(dueAt) && dueAt <= now;
    });
  }, [openTasks]);

  const latestConsequence = consequenceRows[0] ?? null;
  const latestEvaluation = evaluationRows[0] ?? null;
  const joinedParticipantsCount = participantRows.filter((row) => Boolean(row.joined_at)).length;
  const activeParticipantsCount = participantRows.filter(
    (row) => row.response_count > 0 || row.task_updates_count > 0
  ).length;
  const participantsWithCompletedTasksCount = participantRows.filter(
    (row) => row.completed_task_count > 0
  ).length;
  const oldestOverdueTask = overdueTasks
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a.due_at ?? 0).getTime();
      const bTime = new Date(b.due_at ?? 0).getTime();
      return aTime - bTime;
    })[0] ?? null;
  const operatorNextMove = overdueTasks.length > 0
    ? `Clear overdue follow-ups first, starting with ${oldestOverdueTask?.title ?? "the oldest open task"}.`
    : !sessionLive
    ? "Start the exercise before releasing injects or running the runtime engine."
    : pending.length > 0
    ? `Release the next inject when the team is ready for another turn.`
    : latestConsequence
    ? `Review the latest development and confirm whether it needs a named owner.`
    : "No urgent facilitator action is waiting right now.";

  const latestEvaluationSummary = latestEvaluation
    ? summarizeEvaluation(latestEvaluation)
    : null;
  const matchedTraceCount = evaluationRows.filter((row) => row.matched).length;
  const skippedTraceCount = evaluationRows.length - matchedTraceCount;

  // =========================
  // Session control
  // =========================

  async function startExercise() {
    setLoading(true);
    setMsg(null);

    try {
      // preferred: RPC if exists
      const { error } = await supabase.rpc("start_session", {
        p_session_id: sessionId,
      });

      if (error) {
        // fallback: direct update
        const nowIso = new Date().toISOString();
        const { error: updErr } = await supabase
          .from("sessions")
          .update({
            status: "live",
            started_at: nowIso,
            ended_at: null,
          })
          .eq("id", sessionId);

        if (updErr) throw updErr;
      }

      setMsg("Exercise started (T=0).");
      await refreshMeta();
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to start exercise."));
    } finally {
      setLoading(false);
    }
  }

  async function endExercise() {
    setLoading(true);
    setMsg(null);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("sessions")
        .update({ status: "ended", ended_at: nowIso })
        .eq("id", sessionId);
      if (error) throw error;
      setMsg("Exercise ended.");
      await refreshMeta();
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to end exercise."));
    } finally {
      setLoading(false);
    }
  }

  async function restartExercise() {
    setLoading(true);
    setMsg(null);
    try {
      // preferred: RPC if exists
      const { error } = await supabase.rpc("restart_session", {
        p_session_id: sessionId,
      });

      if (error) {
        // fallback: reset timestamps only
        const { error: updErr } = await supabase
          .from("sessions")
          .update({ status: "draft", started_at: null, ended_at: null })
          .eq("id", sessionId);

        if (updErr) throw updErr;
      }

      setMsg("Session restarted.");
      await refreshMeta();
      await refreshInjectLibrary();
      await refreshEngineState();
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to restart session."));
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // Inject release
  // =========================

  async function deliverDue() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await deliverDueInjects(sessionId);
      setMsg(`Delivered ${res.delivered} due inject(s).`);
      await refreshInjectLibrary();
      await refreshEngineState();
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to deliver due injects."));
    } finally {
      setLoading(false);
    }
  }

  async function deliverInjectNow(injectId: string) {
    const nowIso = new Date().toISOString();
    const { error } = await supabase.rpc("release_session_inject", {
      p_session_id: sessionId,
      p_inject_id: injectId,
      p_delivered_at: nowIso,
    });
    if (error) throw error;
  }

  async function deliverSelected() {
    if (!selectedSI?.inject_id) return;
    setLoading(true);
    setMsg(null);
    try {
      await deliverInjectNow(selectedSI.inject_id);
      setMsg(`Delivered: ${selectedSI.injects?.title ?? "inject"}`);
      await refreshInjectLibrary();
      await refreshEngineState();
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to deliver inject."));
    } finally {
      setLoading(false);
    }
  }

  async function deliverNextPending() {
    const next = pending?.[0];
    if (!next?.inject_id) return;
    setLoading(true);
    setMsg(null);
    try {
      await deliverInjectNow(next.inject_id);
      setMsg(`Delivered next: ${next.injects?.title ?? "inject"}`);
      await refreshInjectLibrary();
      await refreshEngineState();
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to deliver next inject."));
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // Quick message
  // =========================

  async function sendQuickMessage() {
    const validPayload = validateMessagePayload(qmTitle, qmBody);
    if (!validPayload.ok) {
      setMsg(validPayload.error);
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      await sendInjectToSession(sessionId, validPayload.value.title, validPayload.value.body, {
        channel: normalizeStream(qmChannel),
        severity: qmSeverity.trim() ? qmSeverity.trim() : null,
        sender_name: qmSender.trim() ? qmSender.trim() : null,
        sender_org: null,
        requires_decision: qmRequiresDecision,
        decision_template_key: qmDecisionTemplateKey.trim() ? qmDecisionTemplateKey.trim() : null,
        media_files: qmMediaFiles,
      });
      setMsg("Quick message sent.");
      setQmTitle("");
      setQmBody("");
      setQmSeverity("");
      setQmRequiresDecision(false);
      setQmDecisionTemplateKey("");
      setQmSender("Facilitator");
      setQmMediaFiles([]);
      await refreshInjectLibrary();
      await refreshEngineState();
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to send quick message."));
    } finally {
      setLoading(false);
    }
  }

  async function processOverdueNow() {
    setEngineRefreshing(true);
    setMsg(null);
    try {
      const result = await processOverdueSessionTasks(sessionId);
      await refreshEngineState();
      const parts: string[] = [];
      if (result.created_consequences > 0) parts.push(`${result.created_consequences} consequences`);
      if (result.created_tasks > 0) parts.push(`${result.created_tasks} tasks`);
      if (result.created_injects > 0) parts.push(`${result.created_injects} injects`);
      setMsg(
        parts.length > 0
          ? `Processed overdue runtime: ${parts.join(", ")}.`
          : "No overdue runtime actions were needed."
      );
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to process overdue runtime."));
    } finally {
      setEngineRefreshing(false);
    }
  }

  async function runManualRulesNow() {
    setEngineRefreshing(true);
    setMsg(null);
    try {
      const result = await evaluateSessionRules({
        sessionId,
        eventType: "manual",
      });
      await refreshEngineState();
      const parts: string[] = [];
      if (result.created_consequences > 0) parts.push(`${result.created_consequences} consequences`);
      if (result.created_tasks > 0) parts.push(`${result.created_tasks} tasks`);
      if (result.created_injects > 0) parts.push(`${result.created_injects} injects`);
      setMsg(
        parts.length > 0
          ? `Manual rules run: ${parts.join(", ")}.`
          : "Manual rules ran, but nothing new was generated."
      );
    } catch (e: unknown) {
      setMsg(getErrorMessage(e, "Failed to run manual rules."));
    } finally {
      setEngineRefreshing(false);
    }
  }

  async function copyJoinCode() {
    const code = meta?.join_code?.trim();
    if (!code) return;

    const ok = await copyTextToClipboard(code);
    setMsg(ok ? "Join code copied." : "Clipboard unavailable. Copy code manually.");
    if (!ok) return;

    setJoinCodeCopied(true);
    window.setTimeout(() => setJoinCodeCopied(false), 1200);
  }

  const controlBlock = (
    <section className="rounded-[8px] border border-[var(--studio-border-strong)] bg-[hsl(var(--card))] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ToolSectionTitle
          icon={<Radio />}
          title="Session controls"
          subtitle={operatorNextMove}
        />

        <div className="flex flex-wrap items-center justify-end gap-2">
          {effectiveScenarioId ? (
            <Link
              href={`/facilitator/scenarios/${effectiveScenarioId}`}
              className="inline-flex h-8 items-center justify-center rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--background))] px-3 text-xs font-semibold text-[color:var(--studio-ink)] transition hover:border-[var(--studio-border-strong)]"
            >
              Scenario editor
            </Link>
          ) : null}
          <Button variant="default" size="sm" onClick={startExercise} disabled={loading} className="gap-2">
            <PlayCircle className="h-4 w-4" />
            {loading ? "..." : "Start"}
          </Button>
          <Button variant="outline" size="sm" onClick={endExercise} disabled={loading} className="gap-2">
            <Square className="h-4 w-4" />
            End
          </Button>
          <Button variant="outline" size="sm" onClick={restartExercise} disabled={loading} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <ToolMetric
          icon={<Activity />}
          label="Status"
          value={
            <span className="inline-flex items-center gap-2">
              <span
                className={[
                  "h-2.5 w-2.5 rounded-full",
                  sessionLive ? "bg-emerald-500 shadow-[0_0_0_4px_hsl(152_70%_45%/0.14)]" : "bg-[color:var(--studio-muted2)]",
                ].join(" ")}
              />
              {normalizeSessionStatus(meta?.status ?? null)}
            </span>
          }
          tone={sessionLive ? "success" : "neutral"}
        />
        <ToolMetric icon={<Users />} label="Participants" value={joinedParticipantsCount} hint={`${activeParticipantsCount} active`} />
        <ToolMetric icon={<Zap />} label="Injects" value={pending.length} hint={`${scenarioInjects.length} total`} tone={pending.length > 0 ? "warning" : "neutral"} />
        <ToolMetric icon={<ClipboardList />} label="Open tasks" value={openTasks.length} hint="active" />
        <ToolMetric icon={<AlertTriangle />} label="Overdue" value={overdueTasks.length} hint="review" tone={overdueTasks.length > 0 ? "danger" : "neutral"} />
        <ToolMetric icon={<Sparkles />} label="Traces" value={evaluationRows.length} hint={`${matchedTraceCount}/${skippedTraceCount}`} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--studio-border)] pt-2">
        <button
          type="button"
          onClick={copyJoinCode}
          disabled={!meta?.join_code}
          className="inline-flex min-h-8 items-center gap-2 rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--background))] px-3 text-xs font-semibold text-[color:var(--studio-ink)] transition hover:border-[var(--studio-border-strong)] disabled:opacity-55"
          title={meta?.join_code ? "Copy join code" : "No join code"}
        >
          {joinCodeCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{meta?.join_code ? `Code ${meta.join_code}` : "No join code"}</span>
        </button>
        {meta?.started_at ? <Badge>Started {fmtIso(meta.started_at)}</Badge> : null}
        {meta?.ended_at ? <Badge>Ended {fmtIso(meta.ended_at)}</Badge> : null}
        <Button
          variant="outline"
          size="sm"
          onClick={runManualRulesNow}
          disabled={!sessionLive || engineRefreshing || manualRuleCount === 0}
          className="ml-auto gap-2"
        >
          <PlayCircle className="h-4 w-4" />
          Manual rules
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={processOverdueNow}
          disabled={!sessionLive || engineRefreshing}
          className="gap-2"
        >
          <TimerReset className="h-4 w-4" />
          {engineRefreshing ? "Working..." : "Overdue"}
        </Button>
      </div>
    </section>
  );

  const participantsBlock = (
    <section className="overflow-hidden rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--card))]">
      <button
        type="button"
        onClick={() => setParticipantDetailsOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
        aria-expanded={participantDetailsOpen}
      >
        <ToolSectionTitle
          icon={<Users />}
          title="Participants"
          subtitle={`${joinedParticipantsCount} joined · ${activeParticipantsCount} active · ${participantsWithCompletedTasksCount} done`}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {participantDetailsOpen ? "Hide" : "Show"}
          </span>
          {participantDetailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      <Collapsible open={participantDetailsOpen}>
        <div className="border-t border-[var(--studio-border)] bg-[hsl(var(--background))] p-3">
          <div className="mb-3 flex justify-end">
            <Link
              href={`/facilitator/sessions/${sessionId}/roster`}
              className="text-xs font-semibold text-muted-foreground transition hover:text-foreground"
            >
              Open roster
            </Link>
          </div>
          <div className="space-y-2">
            {participantRows.length === 0 ? (
              <EmptyPanel>No participants have joined this session yet.</EmptyPanel>
            ) : (
              participantRows.slice(0, compact ? 5 : 6).map((row) => {
                const state = getParticipantState(row);

                return (
                  <div
                    key={row.participant_id}
                    className="rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--card))] px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {row.display_name ?? "Anonymous"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {row.role ? row.role.replaceAll("_", " ") : "participant"}
                        </div>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${state.className}`}
                      >
                        {state.label}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Joined {fmtShort(row.joined_at)}</span>
                      {row.last_activity_at ? <span>Last active {fmtShort(row.last_activity_at)}</span> : null}
                      {row.response_count > 0 ? <span>{row.response_count} responses</span> : null}
                      {row.task_updates_count > 0 ? <span>{row.task_updates_count} task updates</span> : null}
                      {row.completed_task_count > 0 ? <span>{row.completed_task_count} done</span> : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Collapsible>
    </section>
  );

  const engineBlock = (
    <section className="overflow-hidden rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--card))]">
      <button
        type="button"
        onClick={() => setRuntimeDetailOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
        aria-expanded={runtimeDetailOpen}
      >
        <ToolSectionTitle
          icon={<Sparkles />}
          title="Runtime detail"
          subtitle={latestConsequence?.title ?? latestEvaluation?.rule_template?.rule_name ?? "Nothing generated yet"}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {runtimeDetailOpen ? "Hide" : "Show"}
          </span>
          {runtimeDetailOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      <Collapsible open={runtimeDetailOpen}>
        <div className="border-t border-[var(--studio-border)] bg-[hsl(var(--background))] p-3">
          {oldestOverdueTask ? (
            <div className="mb-2.5 rounded-[8px] border border-red-500/20 bg-red-500/8 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-300/90">
                Oldest overdue follow-up
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">{oldestOverdueTask.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {oldestOverdueTask.assigned_role
                  ? `Owner: ${oldestOverdueTask.assigned_role}`
                  : "No owner yet"}{" "}
                • Due {fmtIso(oldestOverdueTask.due_at)}
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--card))]">
            <button
              type="button"
              onClick={() => setLatestInsightsOpen((value) => !value)}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
              aria-expanded={latestInsightsOpen}
            >
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Latest insight
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {latestConsequence?.title ??
                    latestEvaluation?.rule_template?.rule_name ??
                    "Nothing generated yet"}
                </div>
              </div>
              {latestInsightsOpen ? <ChevronUp className="h-4 w-4 opacity-70" /> : <ChevronDown className="h-4 w-4 opacity-70" />}
            </button>
            <Collapsible open={latestInsightsOpen}>
              <div className="border-t border-[var(--studio-border)] p-3">
                {latestConsequence ? (
                  <div className="rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--background))] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Latest development
                    </div>
                    <div className="mt-1 text-sm font-semibold">{latestConsequence.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {latestConsequence.consequence_type.replaceAll("_", " ")} • {fmtIso(latestConsequence.applied_at)}
                    </div>
                    {latestConsequence.description ? (
                      <div className="mt-2 text-sm text-foreground">{latestConsequence.description}</div>
                    ) : null}
                  </div>
                ) : null}

                {latestEvaluation ? (
                  <div className="mt-2.5 rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--background))] p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Latest rule trace
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {latestEvaluation.rule_template?.rule_name ?? latestEvaluation.event_type.replaceAll("_", " ")}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {latestEvaluationSummary ?? "No trace details recorded"} • {fmtIso(latestEvaluation.created_at)}
                    </div>
                  </div>
                ) : null}
              </div>
            </Collapsible>
          </div>

          <div className="mt-2 overflow-hidden rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--card))]">
            <button
              type="button"
              onClick={() => setTraceHistoryOpen((value) => !value)}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
              aria-expanded={traceHistoryOpen}
            >
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Rule traces
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  Last {evaluationRows.length} evaluations
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700">
                  {matchedTraceCount} matched
                </span>
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700">
                  {skippedTraceCount} skipped
                </span>
                {traceHistoryOpen ? <ChevronUp className="h-4 w-4 opacity-70" /> : <ChevronDown className="h-4 w-4 opacity-70" />}
              </div>
            </button>
            <Collapsible open={traceHistoryOpen}>
              <div className="border-t border-[var(--studio-border)] p-3">
                {evaluationRows.length === 0 ? (
                  <EmptyPanel>No rule evaluations recorded yet for this session.</EmptyPanel>
                ) : (
                  <div className="space-y-2">
                {evaluationRows.map((row) => {
                  const focus = describeEvaluationFocus(row);
                  const triggerLabel =
                    row.rule_template?.trigger_type?.replaceAll("_", " ") ??
                    row.event_type.replaceAll("_", " ");

                  return (
                    <div
                      key={row.id}
                      className="rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--background))] px-3 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={
                                row.matched
                                  ? "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700"
                                  : "rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700"
                              }
                            >
                              {row.matched ? "Matched" : "Skipped"}
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                              {row.rule_template?.rule_name ?? row.event_type.replaceAll("_", " ")}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {summarizeEvaluation(row)}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>{fmtIso(row.created_at)}</div>
                          <div className="mt-1">trigger: {triggerLabel}</div>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
                        {row.rule_template?.rule_key ? (
                          <span>
                            key: <span className="text-foreground">{row.rule_template.rule_key}</span>
                          </span>
                        ) : null}
                        {focus ? (
                          <span>
                            focus: <span className="text-foreground">{focus}</span>
                          </span>
                        ) : null}
                        {readContextValue(row.context, "source") ? (
                          <span>
                            source:{" "}
                            <span className="text-foreground">
                              {readContextValue(row.context, "source")}
                            </span>
                          </span>
                        ) : null}
                        {readContextValue(row.context, "task_status") ? (
                          <span>
                            task:{" "}
                            <span className="text-foreground">
                              {readContextValue(row.context, "task_status")?.replaceAll("_", " ")}
                            </span>
                          </span>
                        ) : null}
                      </div>

                      {row.rule_template?.description ? (
                        <div className="mt-2 text-sm text-foreground/80">
                          {row.rule_template.description}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            </div>
            </Collapsible>
          </div>
        </div>
      </Collapsible>
    </section>
  );

  const injectBlock = (
    <section className="overflow-hidden rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--card))]">
            <button
              onClick={() => setInjectReleaseOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
            >
              <ToolSectionTitle
                icon={<Zap />}
                title="Inject release"
                subtitle={`${pending.length} pending of ${scenarioInjects.length}`}
              />

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {injectReleaseOpen ? "Hide" : "Show"}
                </span>
                {injectReleaseOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>

            {injectReleaseOpen ? (
              <div className="border-t border-[var(--studio-border)] bg-[hsl(var(--background))] p-3">
                <div className="grid gap-2">
                  <Select value={selectedSiId} onChange={setSelectedSiId}>
                    <option value="">— Select pending inject —</option>
                    {pending.map((si) => (
                      <option key={si.id} value={si.id}>
                        {String(si.order_index ?? 0).padStart(2, "0")} ·{" "}
                        {si.injects?.title ?? "Untitled"}{" "}
                        ({formatInjectReleaseOffset(si.release_offset_minutes)})
                      </option>
                    ))}
                  </Select>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={deliverDue}
                      disabled={!sessionLive || loading}
                      className="h-10"
                    >
                      Due
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={deliverNextPending}
                      disabled={!sessionLive || loading || pending.length === 0}
                      className="h-10"
                    >
                      Next
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={deliverSelected}
                      disabled={!sessionLive || loading || !selectedSI?.inject_id}
                      className="h-10"
                    >
                      Now
                    </Button>
                  </div>
                </div>

                {selectedSI ? (
                  <div className="mt-3 rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--background))] p-3">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Preview
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {selectedSI.injects?.title ?? "Untitled"}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {selectedSI.injects?.body ?? "—"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
                      <span>stream: {normalizeStream(selectedSI.injects?.channel)}</span>
                      <span>
                        severity: {selectedSI.injects?.severity ?? "—"}
                      </span>
                      <span>
                        sender: {selectedSI.injects?.sender_name ?? "—"} /{" "}
                        {selectedSI.injects?.sender_org ?? "—"}
                      </span>
                    </div>
                    {(selectedSI.injects?.media ?? []).some((media) => Boolean(media.signed_url)) ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {(selectedSI.injects?.media ?? [])
                          .filter((media) => Boolean(media.signed_url))
                          .slice(0, 4)
                          .map((media) => (
                            <img
                              key={media.id}
                              src={media.signed_url ?? undefined}
                              alt={media.alt_text ?? selectedSI.injects?.title ?? "Inject image"}
                              className="aspect-[4/3] w-full rounded-[8px] border border-[var(--studio-border)] object-cover"
                            />
                          ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
    </section>
  );

  const quickMessageBlock = (
    <section className="overflow-hidden rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--card))]">
            <button
              onClick={() => setQuickMsgOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
            >
              <ToolSectionTitle icon={<Send />} title="Quick message" subtitle="Send an ad-hoc inject" />

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {quickMsgOpen ? "Hide" : "Show"}
                </span>
                {quickMsgOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>

            {quickMsgOpen ? (
              <div className="border-t border-[var(--studio-border)] bg-[hsl(var(--background))] p-3">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label htmlFor={quickTitleId} className="text-sm font-semibold">Title</label>
                    <Input
                      id={quickTitleId}
                      value={qmTitle}
                      onChange={(e) => setQmTitle(e.target.value)}
                      placeholder="e.g., Inbox update"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor={quickStreamId} className="text-sm font-semibold">Stream</label>
                    <Select id={quickStreamId} value={qmChannel} onChange={setQmChannel}>
                      <option value="inbox">Inbox</option>
                      <option value="pulse">Pulse</option>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor={quickBodyId} className="text-sm font-semibold">Body</label>
                    <textarea
                      id={quickBodyId}
                      value={qmBody}
                      onChange={(e) => setQmBody(e.target.value)}
                      className="min-h-[112px] w-full rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-2 text-sm focus-visible:shadow-[var(--studio-ring)] focus-visible:outline-none"
                      placeholder="Write the message..."
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setQuickAdvancedOpen((value) => !value)}
                      className="flex h-10 w-full items-center justify-between rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--card))] px-3 text-left text-sm font-semibold"
                      aria-expanded={quickAdvancedOpen}
                    >
                      <span>Options, images, decision flow</span>
                      {quickAdvancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <Collapsible open={quickAdvancedOpen}>
                      <div className="mt-2 space-y-3 rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--card))] p-3">
                        <InjectMediaField
                          existingMedia={[]}
                          pendingFiles={qmMediaFiles}
                          onAddFiles={(files) =>
                            setQmMediaFiles((prev) => [...prev, ...createPendingInjectMedia(files, qmTitle)])
                          }
                          onMovePending={(fromIndex, toIndex) =>
                            setQmMediaFiles((prev) => {
                              if (toIndex < 0 || toIndex >= prev.length || fromIndex === toIndex) return prev;
                              const next = [...prev];
                              const [moved] = next.splice(fromIndex, 1);
                              next.splice(toIndex, 0, moved);
                              return next;
                            })
                          }
                          onUpdatePendingAlt={(index, altText) =>
                            setQmMediaFiles((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, alt_text: altText } : item
                              )
                            )
                          }
                          onRemovePending={(index) =>
                            setQmMediaFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))
                          }
                          disabled={!sessionLive || loading}
                        />

                        <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor={quickSeverityId} className="text-sm font-semibold">Severity</label>
                        <Select id={quickSeverityId} value={qmSeverity} onChange={setQmSeverity}>
                          <option value="">No severity</option>
                          <option value="low">low</option>
                          <option value="medium">medium</option>
                          <option value="high">high</option>
                          <option value="critical">critical</option>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label htmlFor={quickSenderId} className="text-sm font-semibold">Sender</label>
                        <Input
                          id={quickSenderId}
                          value={qmSender}
                          onChange={(e) => setQmSender(e.target.value)}
                          placeholder="Facilitator"
                        />
                      </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-semibold">Decision flow</div>
                          <label htmlFor={quickDecisionRequiredId} className="flex items-center gap-2 text-sm text-foreground">
                            <input
                              id={quickDecisionRequiredId}
                              type="checkbox"
                              checked={qmRequiresDecision}
                              onChange={(e) => setQmRequiresDecision(e.target.checked)}
                            />
                            Mark as decision-required
                          </label>
                          <Select
                            id={quickDecisionTemplateId}
                            value={qmDecisionTemplateKey}
                            onChange={setQmDecisionTemplateKey}
                            disabled={!qmRequiresDecision}
                          >
                            <option value="">No decision template</option>
                            {decisionTemplateOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </div>
                    </Collapsible>
                  </div>
                </div>

                <div className="mt-3">
                  <Button
                    variant="default"
                    onClick={sendQuickMessage}
                    disabled={!sessionLive || loading}
                    className="h-10 min-w-[144px]"
                  >
                    {loading ? "..." : "Send message"}
                  </Button>
                </div>
              </div>
            ) : null}
    </section>
  );

  const messageBlock = msg ? (
    <div className="rounded-[8px] border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-xs font-semibold text-emerald-800">
      {msg}
    </div>
  ) : null;

  const content = compact ? (
    <div className="space-y-3">
      {controlBlock}
      {messageBlock}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="space-y-3">
          {participantsBlock}
          {injectBlock}
          {quickMessageBlock}
        </div>
        <div className="space-y-3">
          {engineBlock}
        </div>
      </div>
    </div>
  ) : (
    <div className="space-y-3">
      {controlBlock}
      {messageBlock}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="space-y-3">
          {participantsBlock}
        </div>
        <div className="space-y-3">
          {engineBlock}
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {injectBlock}
        {quickMessageBlock}
      </div>
    </div>
  );

  if (compact) {
    return <div className="space-y-4">{content}</div>;
  }

  return <div className="space-y-3">{content}</div>;
}
