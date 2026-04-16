// app/(app)/sessions/[id]/page.tsx
"use client";

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createPortal } from "react-dom";

import { supabase } from "@/lib/supabaseClient";
import {
  type Scenario,
} from "@/lib/scenarios";
import { getErrorMessage } from "@/lib/errors";

import {
  getSessionSituation,
  updateCasualties,
  type SessionSituation,
  type SessionInject,
  getSessionActions,
  addSessionAction,
  type SessionAction,
  subscribeActionsPayload,
  subscribeSituationPayload,
  subscribeSessionMetaPayload,
  sendInjectToSession,
  subscribeInbox,
  subscribePulse,
  subscribeSessionInjectsPayload,
} from "@/lib/sessions";
import {
  createSessionDecision,
  createSessionTask,
  evaluateSessionRules,
  listSessionDecisions,
  listSessionConsequences,
  listSessionTasks,
  processOverdueSessionTasks,
  subscribeSessionConsequencesPayload,
  updateSessionTaskStatus,
  type SessionConsequence,
  type SessionDecision,
  type SessionTask,
} from "@/lib/sessionEngine";

import HintTooltip from "@/app/components/HintTooltip";
import SessionFeedAndDetail from "@/app/components/session-runtime/SessionFeedAndDetail";
import SessionHeaderPanel from "@/app/components/session-runtime/SessionHeaderPanel";
import SessionParticipantBoards from "@/app/components/session-runtime/SessionParticipantBoards";
import {
  Badge,
  Chip,
  consequenceImpactLabel,
  consequenceSeverityTone,
  consequenceTypeLabel,
  fmt,
  humanActionLabel,
  humanDecisionLabel,
  isEditableTarget,
  isUuid,
  RuntimeMetric,
  Select,
  taskPriorityTone,
  taskStatusTone,
  useMediaQuery,
} from "@/app/components/session-runtime/sessionRuntimeUi";

import { Button } from "@/app/components/ui/button";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Radio,
  Sparkles,
  ListChecks,
  CheckSquare,
} from "lucide-react";

type SelectedSource = "inbox" | "pulse";
type StreamTab = "inbox" | "pulse";
type TimelineKind = "inject" | "action" | "decision" | "task" | "consequence";
type TimelineWindow = "15m" | "60m" | "all";
type TimelineRelation = {
  label: string;
  emphasis?: "primary" | "secondary";
};
type TimelineRefs = {
  injectId?: string | null;
  actionId?: string | null;
  decisionId?: string | null;
  taskId?: string | null;
  sourceActionId?: string | null;
};

function lsKey(sessionId: string, kind: "inbox" | "pulse") {
  return `decisionary.seen.${kind}.${sessionId}`;
}

type SessionMetaRow = {
  scenario_id?: string | null;
  scenario?: string | null;
  scenarioId?: string | null;
  started_at?: string | null;
  created_by?: string | null;
  session_mode?: string | null;
  participant_limit?: number | null;
};

type SessionRoleRow = {
  role_key?: string | null;
  role?: string | null;
  role_id?: string | null;
  user_id?: string | null;
  member_id?: string | null;
  profile_id?: string | null;
  participant_id?: string | null;
  owner_id?: string | null;
};

type SessionMetaPayloadRow = {
  started_at?: string | null;
  status?: string | null;
  ended_at?: string | null;
};


function eventTone(kind: "inject" | "action" | "decision" | "task" | "consequence") {
  if (kind === "inject") return "border-sky-500/20 bg-sky-500/10 text-sky-800 dark:text-sky-300";
  if (kind === "action") return "border-slate-500/20 bg-slate-500/10 text-slate-800 dark:text-slate-300";
  if (kind === "decision") return "border-indigo-500/20 bg-indigo-500/10 text-indigo-800 dark:text-indigo-300";
  if (kind === "task") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  return "border-orange-500/20 bg-orange-500/10 text-orange-800 dark:text-orange-300";
}

function timelineWindowMinutes(window: TimelineWindow) {
  if (window === "15m") return 15;
  if (window === "60m") return 60;
  return null;
}

function timelineBucketLabel(at: string | null) {
  const ts = new Date(at ?? 0).getTime();
  if (!Number.isFinite(ts)) return "Older";
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (diffMin <= 15) return "Last 15 minutes";
  if (diffMin <= 60) return "Last hour";
  return "Earlier";
}

function compactLabel(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  return normalized.length > 44 ? `${normalized.slice(0, 41)}...` : normalized;
}

function compactId(value: string | null | undefined, prefix: string) {
  if (!value) return prefix;
  return `${prefix} ${value.slice(0, 8)}`;
}

function timelineConnectorLabel(
  current: { kind: TimelineKind; sessionInjectId: string | null; refs: TimelineRefs },
  next: { kind: TimelineKind; sessionInjectId: string | null; refs: TimelineRefs; sourceId: string } | null
) {
  if (!next) return null;

  if (current.kind === "task" && current.refs.decisionId && current.refs.decisionId === next.sourceId) {
    return "created after decision";
  }
  if (current.kind === "task" && current.refs.sourceActionId && current.refs.sourceActionId === next.sourceId) {
    return "created after response";
  }
  if (current.kind === "consequence" && current.refs.decisionId && current.refs.decisionId === next.sourceId) {
    return "followed decision";
  }
  if (current.kind === "consequence" && current.refs.taskId && current.refs.taskId === next.sourceId) {
    return "linked to follow-up";
  }
  if (current.kind === "decision" && current.refs.actionId && current.refs.actionId === next.sourceId) {
    return "followed response";
  }
  if (current.kind === "action" && current.refs.injectId && current.refs.injectId === next.sourceId) {
    return "response to update";
  }

  return null;
}

export default function SessionParticipantPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ?? "";
  const validSessionId = useMemo(() => isUuid(sessionId), [sessionId]);

  const isMobile = useMediaQuery("(max-width: 1100px)");
  const copPanelId = useId();
  const toolsPanelId = useId();
  const filtersPanelId = useId();
  const insightsPanelId = useId();

  const [error, setError] = useState<string | null>(null);

  // meta
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [sessionOwnerId, setSessionOwnerId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<"rehearsal" | "live">("live");
  const [sessionParticipantLimit, setSessionParticipantLimit] = useState<number | null>(null);
  const [exerciseClock, setExerciseClock] = useState("T=—");

  // role gating
  const [isFacilitator, setIsFacilitator] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  // COP
  const [copOpen, setCopOpen] = useState(false);
  const [situation, setSituation] = useState<SessionSituation | null>(null);

  // Selection
  const [selectedItem, setSelectedItem] = useState<SessionInject | null>(null);
  const [selectedSource, setSelectedSource] = useState<SelectedSource>("inbox");
  const [focusedThreadId, setFocusedThreadId] = useState<string | null>(null);

  // Streams tabs + filters popover
  const [streamTab, setStreamTab] = useState<StreamTab>("inbox");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersWrapRef = useRef<HTMLDivElement | null>(null);
  const filtersButtonRef = useRef<HTMLButtonElement | null>(null);
  const filtersPanelRef = useRef<HTMLDivElement | null>(null);
  const [filtersPanelPosition, setFiltersPanelPosition] = useState<{ top: number; left: number } | null>(null);

  // Inbox filters
  const [inboxSearch, setInboxSearch] = useState("");
  const [inboxSeverity, setInboxSeverity] = useState<string | null>(null);
  const [inboxChannel, setInboxChannel] = useState<string | null>(null);

  // Pulse filters
  const [pulseSearch, setPulseSearch] = useState("");
  const [pulseSeverity, setPulseSeverity] = useState<string | null>(null);

  // Actions (log)
  const [actions, setActions] = useState<SessionAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<SessionDecision[]>([]);
  const [tasks, setTasks] = useState<SessionTask[]>([]);
  const [consequences, setConsequences] = useState<SessionConsequence[]>([]);
  const [taskBusyId, setTaskBusyId] = useState<string | null>(null);
  const [runtimeNotice, setRuntimeNotice] = useState<string | null>(null);
  const [selectedThreadOnly, setSelectedThreadOnly] = useState(false);
  const [runtimeTasksOnly, setRuntimeTasksOnly] = useState(false);
  const [timelineWindow, setTimelineWindow] = useState<TimelineWindow>("60m");
  const [hoveredThreadId, setHoveredThreadId] = useState<string | null>(null);
  const [selectedTimelineEventId, setSelectedTimelineEventId] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<Record<TimelineKind, boolean>>({
    inject: true,
    action: true,
    decision: true,
    task: true,
    consequence: true,
  });

  const [comment, setComment] = useState("");

  // Facilitator tools popover
  const [toolsOpen, setToolsOpen] = useState(false);
  const [advancedInsightsOpen, setAdvancedInsightsOpen] = useState(false);

  // Unseen badges
  const [unseenInbox, setUnseenInbox] = useState(0);
  const [unseenPulse, setUnseenPulse] = useState(0);

  const sessionTitle = scenario?.title ? scenario.title : "Session";
  const totalWaitingUpdates = unseenInbox + unseenPulse;

  function setRuntimeNoticeFromResult(
    result: { created_consequences: number; created_tasks: number; created_injects: number } | null
  ) {
    if (!result) return;
    const totalCreated =
      result.created_consequences + result.created_tasks + result.created_injects;
    if (totalCreated === 0) return;

    const parts: string[] = [];
    if (result.created_consequences > 0) {
      parts.push(
        result.created_consequences === 1
          ? "1 consequence"
          : `${result.created_consequences} consequences`
      );
    }
    if (result.created_tasks > 0) {
      parts.push(result.created_tasks === 1 ? "1 task" : `${result.created_tasks} tasks`);
    }
    if (result.created_injects > 0) {
      parts.push(
        result.created_injects === 1 ? "1 follow-up inject" : `${result.created_injects} follow-up injects`
      );
    }

    setRuntimeNotice(`Runtime applied: ${parts.join(", ")}.`);
  }

  function applySessionMeta(row: SessionMetaPayloadRow | null | undefined) {
    if (!row) return;
    const sa = row.started_at ?? null;
    setStartedAt((prev) => {
      const next = typeof sa === "string" && sa ? sa : null;
      return prev === next ? prev : next;
    });
  }

  async function refreshSituation() {
    if (!validSessionId) return;
    try {
      const s = await getSessionSituation(sessionId);
      setSituation(s);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load situation"));
    }
  }

  async function refreshActions() {
    if (!validSessionId) return;
    try {
      setActionsLoading(true);
      setActionsError(null);
      const rows = await getSessionActions(sessionId, 50);
      setActions(rows);
    } catch (e: unknown) {
      setActionsError(getErrorMessage(e, "Failed to load actions"));
    } finally {
      setActionsLoading(false);
    }
  }

  async function refreshDecisionBoard() {
    if (!validSessionId) return;
    try {
      const [decisionRows, taskRows, consequenceRows] = await Promise.all([
        listSessionDecisions(sessionId, 100),
        listSessionTasks(sessionId, 100),
        listSessionConsequences(sessionId, 100),
      ]);
      setDecisions(decisionRows);
      setTasks(taskRows);
      setConsequences(consequenceRows);
    } catch (e: unknown) {
      setActionsError(getErrorMessage(e, "Failed to load decision board"));
    }
  }

  async function refreshScenarioAndOwner() {
    if (!validSessionId) return;
    try {
      const { data: sess, error: sessErr } = await supabase
        .from("sessions")
        .select("scenario_id, started_at, created_by, session_mode, participant_limit")
        .eq("id", sessionId)
        .maybeSingle();

      if (sessErr) throw sessErr;

      const sessRow = (sess ?? null) as SessionMetaRow | null;
      const scenarioId =
        sessRow?.scenario_id ?? sessRow?.scenario ?? sessRow?.scenarioId ?? null;
      const ownerId = sessRow?.created_by ?? null;
      const sa = sessRow?.started_at ?? null;
      const modeValue =
        "session_mode" in (sessRow ?? {}) && (sessRow as { session_mode?: string | null }).session_mode === "rehearsal"
          ? "rehearsal"
          : "live";
      const limitValue =
        "participant_limit" in (sessRow ?? {}) &&
        typeof (sessRow as { participant_limit?: number | null }).participant_limit === "number"
          ? (sessRow as { participant_limit?: number | null }).participant_limit ?? null
          : null;
      setStartedAt(typeof sa === "string" && sa ? sa : null);
      setSessionMode(modeValue);
      setSessionParticipantLimit(limitValue);
      setSessionOwnerId(
        typeof ownerId === "string" && ownerId ? ownerId : null
      );

      if (!scenarioId) {
        setScenario(null);
        return;
      }

      const { data: sc, error: scErr } = await supabase
        .from("scenarios")
        .select("*")
        .eq("id", scenarioId)
        .maybeSingle();

      if (scErr) throw scErr;

      setScenario((sc as Scenario | null) ?? null);
    } catch (e: unknown) {
      setScenario(null);
      setError(
        (prev) =>
          prev ??
          (e instanceof Error
            ? `Scenario/meta load: ${e.message}`
            : "Scenario/meta load failed")
      );
    }
  }

  function getSeen(kind: "inbox" | "pulse") {
    const raw =
      typeof window !== "undefined"
        ? localStorage.getItem(lsKey(sessionId, kind))
        : null;
    const dt = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(dt) ? dt : 0;
  }

  function markSeen(kind: "inbox" | "pulse") {
    const nowIso = new Date().toISOString();
    localStorage.setItem(lsKey(sessionId, kind), nowIso);
    if (kind === "inbox") setUnseenInbox(0);
    if (kind === "pulse") setUnseenPulse(0);
  }

  async function refreshUnseen() {
    if (!validSessionId) return;

    const seenInbox = getSeen("inbox");
    const seenPulse = getSeen("pulse");

    const inboxSince = new Date(seenInbox || 0).toISOString();
    const pulseSince = new Date(seenPulse || 0).toISOString();

    const { count: totalNewInbox } = await supabase
      .from("session_injects")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .gte("delivered_at", inboxSince);

    const { count: pulseNewForInbox } = await supabase
      .from("session_injects")
      .select("id, injects:inject_id(channel)", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .gte("delivered_at", inboxSince)
      .eq("injects.channel", "pulse");

    const inboxNew = Math.max(
      0,
      (totalNewInbox ?? 0) - (pulseNewForInbox ?? 0)
    );
    setUnseenInbox(inboxNew);

    const { count: pulseNew } = await supabase
      .from("session_injects")
      .select("id, injects:inject_id(channel)", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .gte("delivered_at", pulseSince)
      .eq("injects.channel", "pulse");

    setUnseenPulse(pulseNew ?? 0);
  }

  // Initial load
  useEffect(() => {
    if (!validSessionId) return;
    setError(null);
    refreshScenarioAndOwner();
    refreshSituation();
    refreshActions();
    refreshDecisionBoard();
    refreshUnseen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, validSessionId]);

  // Exercise clock tick
  useEffect(() => {
    const tick = () => {
      if (!startedAt) {
        setExerciseClock("T=—");
        return;
      }
      const t0 = new Date(startedAt).getTime();
      const now = Date.now();
      if (Number.isNaN(t0)) {
        setExerciseClock("T=—");
        return;
      }
      const diffMs = Math.max(0, now - t0);
      const totalSec = Math.floor(diffMs / 1000);
      const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
      const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
      const ss = String(totalSec % 60).padStart(2, "0");
      setExerciseClock(`T+${hh}:${mm}:${ss}`);
    };

    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  // Close popovers on Escape/outside click
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setToolsOpen(false);
        setFiltersOpen(false);
      }
    }
    function onDocMouseDown(e: MouseEvent) {
      if (filtersOpen) {
        const el2 = filtersWrapRef.current;
        if (el2 && e.target instanceof Node && !el2.contains(e.target))
          setFiltersOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDocMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDocMouseDown);
    };
  }, [filtersOpen]);

  useLayoutEffect(() => {
    if (!filtersOpen) return;

    const gap = 10;
    const viewportPadding = 16;

    function placePanel() {
      const button = filtersButtonRef.current;
      const panel = filtersPanelRef.current;
      if (!button || !panel) return;

      const anchor = button.getBoundingClientRect();
      const panelWidth = panel.offsetWidth;
      const panelHeight = panel.offsetHeight;

      let nextLeft = anchor.right - panelWidth;
      let nextTop = anchor.bottom + gap;

      if (nextTop + panelHeight > window.innerHeight - viewportPadding) {
        nextTop = Math.max(viewportPadding, anchor.top - panelHeight - gap);
      }

      if (nextLeft < viewportPadding) nextLeft = viewportPadding;
      if (nextLeft + panelWidth > window.innerWidth - viewportPadding) {
        nextLeft = window.innerWidth - panelWidth - viewportPadding;
      }

      setFiltersPanelPosition({ top: nextTop, left: nextLeft });
    }

    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
    };
  }, [filtersOpen, streamTab]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (key === "i") {
        e.preventDefault();
        setStreamTab("inbox");
        setSelectedSource("inbox");
        markSeen("inbox");
        void refreshUnseen();
        return;
      }

      if (key === "p") {
        e.preventDefault();
        setStreamTab("pulse");
        setSelectedSource("pulse");
        markSeen("pulse");
        void refreshUnseen();
        return;
      }

      if (key === "f") {
        e.preventDefault();
        setFiltersOpen((value) => !value);
        return;
      }

      if (key === "c") {
        e.preventDefault();
        setCopOpen((value) => !value);
        return;
      }

      if (key === "d") {
        e.preventDefault();
        setAdvancedInsightsOpen((value) => !value);
        return;
      }

      if (key === "t" && isFacilitator) {
        e.preventDefault();
        setToolsOpen((value) => !value);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFacilitator, refreshUnseen]);

  // ✅ Role gating (session_role_assignments OR created_by fallback)
  useEffect(() => {
    if (!validSessionId) return;
    let alive = true;

    (async () => {
      try {
        setRoleLoading(true);

        const { data: u } = await supabase.auth.getUser();
        const authUserId = u.user?.id;

        if (!authUserId) {
          if (alive) setIsFacilitator(false);
          return;
        }

        // owner = facilitator
        if (sessionOwnerId && sessionOwnerId === authUserId) {
          if (alive) setIsFacilitator(true);
          return;
        }

        const { data, error } = await supabase
          .from("session_role_assignments")
          .select("*")
          .eq("session_id", sessionId);

        if (error) throw error;

        const rows = (data ?? []) as SessionRoleRow[];
        const match = rows.find((r) => {
          const roleKey = r?.role_key ?? r?.role ?? r?.role_id ?? null;
          const uid =
            r?.user_id ??
            r?.member_id ??
            r?.profile_id ??
            r?.participant_id ??
            r?.owner_id ??
            null;
          return roleKey === "facilitator" && uid === authUserId;
        });

        if (alive) setIsFacilitator(Boolean(match));
      } catch {
        if (alive) setIsFacilitator(false);
      } finally {
        if (alive) setRoleLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [sessionId, validSessionId, sessionOwnerId]);

  // Realtime payloads (NO refetch loop)
  useEffect(() => {
    if (!validSessionId) return;

    const unsubA = subscribeActionsPayload(sessionId, (row) => {
      setActions((prev) => [row, ...prev].slice(0, 100));
    });

    const unsubS = subscribeSituationPayload(sessionId, (row) => {
      setSituation((prev) => {
        if (!prev) return row;
        if (prev.updated_at === row.updated_at) return prev;
        return row;
      });
    });

    const unsubM = subscribeSessionMetaPayload(sessionId, (row) => {
      applySessionMeta(row as SessionMetaPayloadRow | null);
    });

    const unsubInjected = subscribeSessionInjectsPayload(sessionId, (row) => {
      void (async () => {
        try {
          const result = await evaluateSessionRules({
            sessionId,
            eventType: "inject_released",
            sessionInjectId: row.id,
          });
          setRuntimeNoticeFromResult(result);
        } catch {
          // ignore runtime evaluation errors in realtime callback
        }
      })();
    });

    const unsubConsequences = subscribeSessionConsequencesPayload(sessionId, (row) => {
      setConsequences((prev) => [row, ...prev.filter((item) => item.id !== row.id)].slice(0, 100));
    });

    // Unseen subscriptions
    const unsubInbox = subscribeInbox(sessionId, () => refreshUnseen(), 300);
    const unsubPulse = subscribePulse(sessionId, () => refreshUnseen(), 300);

    return () => {
      unsubA?.();
      unsubS?.();
      unsubM?.();
      unsubInjected?.();
      unsubConsequences?.();
      unsubInbox?.();
      unsubPulse?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, validSessionId]);

  const selectedActions = useMemo(() => {
    if (!selectedItem) return [];
    return actions.filter((a) => a.session_inject_id === selectedItem.id);
  }, [actions, selectedItem]);

  const openTasks = useMemo(() => {
    return tasks.filter((task) => task.status !== "done" && task.status !== "cancelled");
  }, [tasks]);

  const overdueTaskCount = useMemo(() => {
    const now = Date.now();
    return openTasks.filter((task) => {
      if (!task.due_at) return false;
      const dueAt = new Date(task.due_at).getTime();
      return Number.isFinite(dueAt) && dueAt <= now;
    }).length;
  }, [openTasks]);

  const latestConsequence = consequences[0] ?? null;
  const heroEyebrow =
    sessionMode === "rehearsal"
      ? isFacilitator
        ? "Rehearsal control"
        : "Rehearsal mode"
      : isFacilitator
      ? "Live session control"
      : "Live session";
  const heroHint =
    isFacilitator && totalWaitingUpdates > 0 && overdueTaskCount === 0
      ? "Watch the feed and decide when to introduce the next turn."
      : null;
  const heroSummary = isFacilitator
    ? overdueTaskCount > 0
      ? `Clear ${overdueTaskCount === 1 ? "the overdue follow-up" : `${overdueTaskCount} overdue follow-ups`} before the next turn.`
      : totalWaitingUpdates > 0
      ? "The feed is active and ready for the next facilitator move."
      : latestConsequence
      ? `Latest development: ${compactLabel(latestConsequence.title, "New session development")}.`
      : "Session is stable. Use COP or Facilitator tools when you want to steer the next turn."
    : totalWaitingUpdates > 0
    ? `${totalWaitingUpdates} update${totalWaitingUpdates === 1 ? "" : "s"} waiting. Pick one thread and respond.`
    : latestConsequence
    ? `Latest development: ${compactLabel(latestConsequence.title, "New session development")}.`
    : "Watch the feed, choose one thread, and keep the team moving.";

  const runtimeGeneratedTaskIds = useMemo(() => {
    return new Set(
      tasks
        .filter((task) => task.source_action_id == null && (task.decision_id != null || task.session_inject_id != null))
        .map((task) => task.id)
    );
  }, [tasks]);

  const activeThreadId = selectedThreadOnly ? focusedThreadId ?? selectedItem?.id ?? null : null;

  const visibleTasks = useMemo(() => {
    return openTasks.filter((task) => {
      if (runtimeTasksOnly && !runtimeGeneratedTaskIds.has(task.id)) return false;
      if (activeThreadId && task.session_inject_id !== activeThreadId) return false;
      return true;
    });
  }, [openTasks, runtimeTasksOnly, runtimeGeneratedTaskIds, activeThreadId]);

  const visibleConsequences = useMemo(() => {
    return consequences.filter((item) => {
      if (activeThreadId && item.session_inject_id !== activeThreadId) return false;
      return true;
    });
  }, [consequences, activeThreadId]);

  const visibleActions = useMemo(() => {
    return actions.filter((item) => {
      if (activeThreadId && item.session_inject_id !== activeThreadId) return false;
      return true;
    });
  }, [actions, activeThreadId]);

  const visibleDecisions = useMemo(() => {
    return decisions.filter((item) => {
      if (activeThreadId && item.session_inject_id !== activeThreadId) return false;
      return true;
    });
  }, [decisions, activeThreadId]);

  const actionsById = useMemo(
    () => new Map(actions.map((action) => [action.id, action])),
    [actions]
  );

  const decisionsById = useMemo(
    () => new Map(decisions.map((decision) => [decision.id, decision])),
    [decisions]
  );

  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks]
  );

  const chainEvents = useMemo(() => {
    const items: Array<{
      id: string;
      at: string | null;
      kind: TimelineKind;
      title: string;
      detail: string;
      meta: string[];
      relations: TimelineRelation[];
      refs: TimelineRefs;
      sessionInjectId: string | null;
      sourceId: string;
    }> = [];

    if (activeThreadId && selectedItem?.id === activeThreadId) {
      items.push({
        id: `inject:${selectedItem.id}`,
        at: selectedItem.delivered_at ?? null,
        kind: "inject",
        title: selectedItem.injects?.title ?? "Inject released",
        detail: selectedItem.injects?.body ?? "Selected inject entered the session.",
        meta: [
          selectedItem.injects?.channel ? `Channel ${selectedItem.injects.channel}` : "Inject",
          selectedItem.injects?.severity ? `Severity ${selectedItem.injects.severity}` : "No severity",
        ],
        relations: [
          {
            label: selectedItem.injects?.source_type
              ? `Entered via ${selectedItem.injects.source_type}`
              : "Starting point",
            emphasis: "primary",
          },
          ...(selectedItem.injects?.decision_template_key
            ? [
                {
                  label: `Decision guidance ${selectedItem.injects.decision_template_key}`,
                  emphasis: "secondary" as const,
                },
              ]
            : []),
          ...(selectedItem.injects?.requires_decision
            ? [{ label: "Needs a clear decision", emphasis: "secondary" as const }]
            : []),
        ],
        refs: {
          injectId: selectedItem.id,
        },
        sessionInjectId: selectedItem.id,
        sourceId: selectedItem.id,
      });
    }

    const describeInject = (sessionInjectId: string | null) => {
      if (sessionInjectId && selectedItem?.id === sessionInjectId) {
        return compactLabel(selectedItem.injects?.title, compactId(sessionInjectId, "inject"));
      }
      return compactId(sessionInjectId, "inject");
    };

    for (const action of visibleActions) {
      items.push({
        id: `action:${action.id}`,
        at: action.created_at,
        kind: "action",
        title: humanActionLabel(action.action_type),
        detail: action.comment ?? "Team response recorded.",
        meta: [action.source === "pulse" ? "Pulse" : "Inbox"],
        relations: [
          action.session_inject_id
            ? {
                label: `Responds to ${describeInject(action.session_inject_id)}`,
                emphasis: "primary",
              }
            : {
                label: "Logged as a separate response",
                emphasis: "secondary",
              },
        ],
        refs: {
          injectId: action.session_inject_id,
        },
        sessionInjectId: action.session_inject_id,
        sourceId: action.id,
      });
    }

    for (const decision of visibleDecisions) {
      const linkedAction = decision.action_id ? actionsById.get(decision.action_id) : null;
      items.push({
        id: `decision:${decision.id}`,
        at: decision.created_at,
        kind: "decision",
        title: humanDecisionLabel(decision.decision_type),
        detail: decision.rationale ?? "Team decision recorded.",
        meta: [decision.status.replaceAll("_", " ")],
        relations: [
          decision.action_id
            ? {
                label: `Followed ${linkedAction ? humanActionLabel(linkedAction.action_type).toLowerCase() : compactId(decision.action_id, "response")}`,
                emphasis: "primary",
              }
            : {
                label: "Recorded directly",
                emphasis: "secondary",
              },
          ...(decision.session_inject_id
            ? [
                {
                  label: `Linked to ${describeInject(decision.session_inject_id)}`,
                  emphasis: "secondary" as const,
                },
              ]
            : []),
        ],
        refs: {
          injectId: decision.session_inject_id,
          actionId: decision.action_id,
          decisionId: decision.id,
        },
        sessionInjectId: decision.session_inject_id,
        sourceId: decision.id,
      });
    }

    for (const consequence of visibleConsequences) {
      const linkedDecision = consequence.decision_id ? decisionsById.get(consequence.decision_id) : null;
      const linkedTask = consequence.task_id ? tasksById.get(consequence.task_id) : null;
      items.push({
        id: `consequence:${consequence.id}`,
        at: consequence.applied_at,
        kind: "consequence",
        title: consequence.title,
        detail: consequence.description ?? "A new development was added to the session.",
        meta: [consequenceTypeLabel(consequence), consequence.severity.toUpperCase()],
        relations: [
          ...(consequence.decision_id
            ? [
                {
                  label: `Followed ${linkedDecision ? humanDecisionLabel(linkedDecision.decision_type).toLowerCase() : compactId(consequence.decision_id, "decision")}`,
                  emphasis: "primary" as const,
                },
              ]
            : []),
          ...(consequence.task_id
            ? [
                {
                  label: `Linked to ${compactLabel(linkedTask?.title, compactId(consequence.task_id, "follow-up"))}`,
                  emphasis: "primary" as const,
                },
              ]
            : []),
          ...(consequence.rule_template_id
            ? [
                {
                  label: "Created automatically",
                  emphasis: "secondary" as const,
                },
              ]
            : []),
          ...(consequence.session_inject_id
            ? [
                {
                  label: `Linked to ${describeInject(consequence.session_inject_id)}`,
                  emphasis: "secondary" as const,
                },
              ]
            : []),
        ],
        refs: {
          injectId: consequence.session_inject_id,
          decisionId: consequence.decision_id,
          taskId: consequence.task_id,
        },
        sessionInjectId: consequence.session_inject_id,
        sourceId: consequence.id,
      });
    }

    for (const task of visibleTasks) {
      const linkedDecision = task.decision_id ? decisionsById.get(task.decision_id) : null;
      const linkedAction = task.source_action_id ? actionsById.get(task.source_action_id) : null;
      items.push({
        id: `task:${task.id}`,
        at: task.created_at,
        kind: "task",
        title: task.title,
        detail: task.description ?? "Follow-up task created.",
        meta: [task.status.replaceAll("_", " "), task.priority],
        relations: [
          ...(task.decision_id
            ? [
                {
                  label: `Created after ${linkedDecision ? humanDecisionLabel(linkedDecision.decision_type).toLowerCase() : compactId(task.decision_id, "decision")}`,
                  emphasis: "primary" as const,
                },
              ]
            : []),
          ...(task.source_action_id
            ? [
                {
                  label: `Created after ${linkedAction ? humanActionLabel(linkedAction.action_type).toLowerCase() : compactId(task.source_action_id, "response")}`,
                  emphasis: "primary" as const,
                },
              ]
            : []),
          ...(task.session_inject_id
            ? [
                {
                  label: `Linked to ${describeInject(task.session_inject_id)}`,
                  emphasis: "secondary" as const,
                },
              ]
            : []),
        ],
        refs: {
          injectId: task.session_inject_id,
          decisionId: task.decision_id,
          sourceActionId: task.source_action_id,
          taskId: task.id,
        },
        sessionInjectId: task.session_inject_id,
        sourceId: task.id,
      });
    }

    const maxAgeMinutes = timelineWindowMinutes(timelineWindow);

    return items
      .filter((item) => timelineFilter[item.kind])
      .filter((item) => {
        if (maxAgeMinutes == null) return true;
        const ts = new Date(item.at ?? 0).getTime();
        if (!Number.isFinite(ts)) return false;
        return Date.now() - ts <= maxAgeMinutes * 60_000;
      })
      .sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime())
      .slice(0, 18);
  }, [
    activeThreadId,
    actionsById,
    decisionsById,
    selectedItem,
    tasksById,
    visibleActions,
    visibleConsequences,
    visibleDecisions,
    visibleTasks,
    timelineFilter,
    timelineWindow,
  ]);

  const groupedChainEvents = useMemo(() => {
    const groups: Array<{ label: string; items: typeof chainEvents }> = [];
    for (const event of chainEvents) {
      const label = timelineBucketLabel(event.at);
      const current = groups[groups.length - 1];
      if (current && current.label === label) {
        current.items.push(event);
      } else {
        groups.push({ label, items: [event] });
      }
    }
    return groups;
  }, [chainEvents]);

  const selectedTimelinePathIds = useMemo(() => {
    if (!selectedTimelineEventId) return new Set<string>();

    const eventIds = new Set(chainEvents.map((event) => event.id));
    if (!eventIds.has(selectedTimelineEventId)) return new Set<string>();

    const eventIdBySourceId = new Map(chainEvents.map((event) => [event.sourceId, event.id]));
    const adjacency = new Map<string, Set<string>>();

    const connect = (left: string, right: string) => {
      if (!adjacency.has(left)) adjacency.set(left, new Set());
      if (!adjacency.has(right)) adjacency.set(right, new Set());
      adjacency.get(left)?.add(right);
      adjacency.get(right)?.add(left);
    };

    for (const event of chainEvents) {
      const referencedIds = [
        event.refs.injectId,
        event.refs.actionId,
        event.refs.decisionId,
        event.refs.taskId,
        event.refs.sourceActionId,
      ].filter((value): value is string => Boolean(value));

      for (const referencedId of referencedIds) {
        const relatedEventId = eventIdBySourceId.get(referencedId);
        if (relatedEventId && relatedEventId !== event.id) {
          connect(event.id, relatedEventId);
        }
      }
    }

    const visited = new Set<string>();
    const queue = [selectedTimelineEventId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) queue.push(next);
      }
    }

    return visited;
  }, [chainEvents, selectedTimelineEventId]);

  const selectedTimelinePathEvents = useMemo(() => {
    if (selectedTimelinePathIds.size === 0) return [];
    return chainEvents
      .filter((event) => selectedTimelinePathIds.has(event.id))
      .sort((a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime());
  }, [chainEvents, selectedTimelinePathIds]);

  useEffect(() => {
    if (!validSessionId || openTasks.length === 0) return;

    const checkOverdueTasks = () => {
      void (async () => {
        try {
          const result = await processOverdueSessionTasks(sessionId);
          setRuntimeNoticeFromResult(result);
        } catch {
          // ignore periodic runtime evaluation errors
        }
      })();
    };

    checkOverdueTasks();
    const intervalId = window.setInterval(checkOverdueTasks, 30_000);
    return () => window.clearInterval(intervalId);
  }, [sessionId, validSessionId, openTasks.length]);

  async function doAction(actionType: "ignore" | "escalate" | "act") {
    if (!selectedItem) return;

    try {
      setRuntimeNotice(null);
      const saved = await addSessionAction({
        sessionId,
        sessionInjectId: selectedItem.id,
        source: selectedSource,
        actionType,
        comment: comment.trim() ? comment.trim() : null,
      });

      setActions((prev) => [saved, ...prev]);

      const savedDecision = await createSessionDecision({
        sessionId,
        sessionInjectId: selectedItem.id,
        actionId: saved.id,
        decisionType: actionType,
        rationale: comment.trim() ? comment.trim() : null,
        outcomeCode: `${selectedSource}:${actionType}`,
      });
      setDecisions((prev) => [savedDecision, ...prev]);

      const requiresDecision = Boolean(selectedItem.injects?.requires_decision);
      if (actionType === "escalate" || (requiresDecision && actionType === "act")) {
        const task = await createSessionTask({
          sessionId,
          sessionInjectId: selectedItem.id,
          decisionId: savedDecision.id,
          sourceActionId: saved.id,
          assignedRole: "facilitator",
          title:
            actionType === "escalate"
              ? `Escalate: ${selectedItem.injects?.title ?? "message"}`
              : `Follow-through: ${selectedItem.injects?.title ?? "message"}`,
          description:
            comment.trim() ||
            (actionType === "escalate"
              ? "Escalate this issue and coordinate the next operational response."
              : "Track follow-up actions, updates, and stakeholder communication for this decision."),
          priority: actionType === "escalate" ? "high" : selectedSource === "pulse" ? "high" : "medium",
          status: actionType === "act" ? "in_progress" : "open",
        });
        setTasks((prev) => [task, ...prev]);
        setRuntimeNotice(
          actionType === "escalate"
            ? "Escalation task created."
            : "Decision recorded and follow-through task created."
        );
      }

      if (actionType === "act") {
        const title = `Update: action taken on "${
          selectedItem.injects?.title ?? "message"
        }"`;
        const body =
          `Decision recorded.\n\n` +
          `Action: ACT\n` +
          `Source: ${selectedSource.toUpperCase()}\n` +
          `Reference message ID: ${selectedItem.id}\n` +
          (comment.trim() ? `\nComment:\n${comment.trim()}\n` : "") +
          `\nNext update will follow.`;

        await sendInjectToSession(sessionId, title, body);
        if (!requiresDecision) {
          setRuntimeNotice("Decision recorded.");
        }
      }

      const runtimeResult = await evaluateSessionRules({
        sessionId,
        eventType: "decision_recorded",
        sessionInjectId: selectedItem.id,
        decisionId: savedDecision.id,
        actionId: saved.id,
        source: selectedSource,
      });
      setRuntimeNoticeFromResult(runtimeResult);

      setComment("");
    } catch (e: unknown) {
      setActionsError(getErrorMessage(e, "Failed to save action"));
    }
  }

  async function doPulseDecision(decision: "confirm" | "deny") {
    if (!selectedItem) return;

    try {
      setRuntimeNotice(null);
      const saved = await addSessionAction({
        sessionId,
        sessionInjectId: selectedItem.id,
        source: "pulse",
        actionType: decision === "confirm" ? "act" : "ignore",
        comment: comment.trim()
          ? `${decision.toUpperCase()}: ${comment.trim()}`
          : `${decision.toUpperCase()}`,
      });

      setActions((prev) => [saved, ...prev]);

      const savedDecision = await createSessionDecision({
        sessionId,
        sessionInjectId: selectedItem.id,
        actionId: saved.id,
        decisionType: decision,
        rationale: comment.trim() ? comment.trim() : decision.toUpperCase(),
        outcomeCode: `pulse:${decision}`,
      });
      setDecisions((prev) => [savedDecision, ...prev]);

      const task = await createSessionTask({
        sessionId,
        sessionInjectId: selectedItem.id,
        decisionId: savedDecision.id,
        sourceActionId: saved.id,
        assignedRole: "facilitator",
        title:
          decision === "confirm"
            ? `Publish confirmation: ${selectedItem.injects?.title ?? "pulse item"}`
            : `Publish denial: ${selectedItem.injects?.title ?? "pulse item"}`,
        description:
          comment.trim() ||
          "Coordinate the outward-facing statement and downstream communication.",
        priority: "high",
        status: "in_progress",
      });
      setTasks((prev) => [task, ...prev]);

      const pulseTitle = selectedItem.injects?.title ?? "pulse post";
      const pulseBody = selectedItem.injects?.body ?? "";

      const title =
        decision === "confirm"
          ? `Official confirmation regarding "${pulseTitle}"`
          : `Official denial regarding "${pulseTitle}"`;

      const body =
        (decision === "confirm"
          ? `We confirm that the information circulating is accurate.`
          : `We deny the information currently circulating.`) +
        `\n\nReference pulse message ID: ${selectedItem.id}` +
        (comment.trim() ? `\n\nComment:\n${comment.trim()}` : "") +
        (pulseBody ? `\n\nQuoted content:\n${pulseBody}` : "");

      await sendInjectToSession(sessionId, title, body);
      const runtimeResult = await evaluateSessionRules({
        sessionId,
        eventType: "decision_recorded",
        sessionInjectId: selectedItem.id,
        decisionId: savedDecision.id,
        actionId: saved.id,
        source: "pulse",
      });
      setRuntimeNoticeFromResult(runtimeResult);
      if (!runtimeResult.created_consequences && !runtimeResult.created_tasks && !runtimeResult.created_injects) {
        setRuntimeNotice("Pulse decision recorded and communications task created.");
      }
      setComment("");
    } catch (e: unknown) {
      setActionsError(getErrorMessage(e, "Failed to process Pulse decision"));
    }
  }

  async function handleTaskStatus(taskId: string, status: SessionTask["status"]) {
    try {
      setTaskBusyId(taskId);
      const updated = await updateSessionTaskStatus({ taskId, status });
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
    } catch (e: unknown) {
      setActionsError(getErrorMessage(e, "Failed to update task"));
    } finally {
      setTaskBusyId(null);
    }
  }

  function focusTimelineEvent(sessionInjectId: string | null, eventId?: string) {
    if (!sessionInjectId) return;
    setSelectedTimelineEventId((current) => (current === eventId ? null : eventId ?? current));
    setFocusedThreadId(sessionInjectId);
    if (selectedItem?.id === sessionInjectId) {
      setSelectedSource(selectedItem.injects?.channel === "pulse" ? "pulse" : "inbox");
      setStreamTab(selectedItem.injects?.channel === "pulse" ? "pulse" : "inbox");
    }
    setSelectedThreadOnly(true);
  }

  function toggleTimelineKind(kind: TimelineKind) {
    setTimelineFilter((prev) => ({ ...prev, [kind]: !prev[kind] }));
  }

  function scrollTimeline(groupLabel: string, direction: "left" | "right") {
    const el = document.querySelector<HTMLElement>(`[data-timeline-group="${groupLabel}"]`);
    if (!el) return;
    const delta = Math.max(280, Math.floor(el.clientWidth * 0.7));
    el.scrollBy({
      left: direction === "left" ? -delta : delta,
      behavior: "smooth",
    });
  }

  function clearInboxFilters() {
    setInboxSearch("");
    setInboxSeverity(null);
    setInboxChannel(null);
  }

  function clearPulseFilters() {
    setPulseSearch("");
    setPulseSeverity(null);
  }

  const inboxFiltersActive =
    Boolean(inboxSearch.trim()) ||
    Boolean(inboxSeverity) ||
    Boolean(inboxChannel);
  const pulseFiltersActive =
    Boolean(pulseSearch.trim()) || Boolean(pulseSeverity);
  const participantVisibleTasks = visibleTasks.slice(0, 5);
  const participantFocusText = selectedItem
    ? selectedItem.injects?.requires_decision
      ? "Review the selected update and decide how your team should respond."
      : "Review the selected update and capture the next operational step."
    : "Choose a message from the feed to see what needs your attention.";

  if (!sessionId) {
    return (
      <div className="text-sm text-[color:var(--studio-muted2)]">
        Loading…
      </div>
    );
  }

  if (!validSessionId) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Invalid session link</h1>
        <p className="text-sm text-[color:var(--studio-muted2)]">
          This session address does not look valid.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Error</h1>
        <p className="text-sm text-[color:var(--studio-muted2)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {runtimeNotice ? <div className="notice notice-success">{runtimeNotice}</div> : null}
      <SessionHeaderPanel
        copPanelId={copPanelId}
        toolsPanelId={toolsPanelId}
        heroEyebrow={heroEyebrow}
        heroHint={heroHint}
        startedAt={startedAt}
        sessionTitle={sessionTitle}
        heroSummary={heroSummary}
        sessionMode={sessionMode}
        sessionParticipantLimit={sessionParticipantLimit}
        copOpen={copOpen}
        setCopOpen={setCopOpen}
        roleLoading={roleLoading}
        isFacilitator={isFacilitator}
        toolsOpen={toolsOpen}
        setToolsOpen={setToolsOpen}
        exerciseClock={exerciseClock}
        scenario={scenario}
        situation={situation}
        validSessionId={validSessionId}
        sessionId={sessionId}
        onUpdateCasualties={async (p) => {
          const s = await updateCasualties({
            sessionId,
            injured: p.injured,
            fatalities: p.fatalities,
            uninjured: p.uninjured,
            unknown: p.unknown,
          });
          setSituation(s);
        }}
        applySessionMeta={applySessionMeta}
      />

      <SessionFeedAndDetail
        isMobile={isMobile}
        sessionId={sessionId}
        streamTab={streamTab}
        setStreamTab={setStreamTab}
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        selectedSource={selectedSource}
        setSelectedSource={setSelectedSource}
        setFocusedThreadId={setFocusedThreadId}
        unseenInbox={unseenInbox}
        unseenPulse={unseenPulse}
        markSeen={markSeen}
        refreshUnseen={refreshUnseen}
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
        filtersWrapRef={filtersWrapRef}
        filtersButtonRef={filtersButtonRef}
        filtersPanelRef={filtersPanelRef}
        filtersPanelPosition={filtersPanelPosition}
        filtersPanelId={filtersPanelId}
        inboxSearch={inboxSearch}
        setInboxSearch={setInboxSearch}
        inboxSeverity={inboxSeverity}
        setInboxSeverity={setInboxSeverity}
        inboxChannel={inboxChannel}
        setInboxChannel={setInboxChannel}
        pulseSearch={pulseSearch}
        setPulseSearch={setPulseSearch}
        pulseSeverity={pulseSeverity}
        setPulseSeverity={setPulseSeverity}
        clearInboxFilters={clearInboxFilters}
        clearPulseFilters={clearPulseFilters}
        inboxFiltersActive={inboxFiltersActive}
        pulseFiltersActive={pulseFiltersActive}
        isFacilitator={isFacilitator}
        selectedActionsCount={selectedActions.length}
        actionsLoading={actionsLoading}
        comment={comment}
        setComment={setComment}
        doAction={doAction}
        doPulseDecision={doPulseDecision}
      />

      <SessionParticipantBoards
        isMobile={isMobile}
        overdueTaskCount={overdueTaskCount}
        openTasks={openTasks}
        selectedItemExists={Boolean(selectedItem)}
        participantFocusText={participantFocusText}
        latestConsequence={latestConsequence}
        participantVisibleTasks={participantVisibleTasks}
        taskBusyId={taskBusyId}
        handleTaskStatus={handleTaskStatus}
      />

      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
        <button
          type="button"
          onClick={() => setAdvancedInsightsOpen((value) => !value)}
          aria-expanded={advancedInsightsOpen}
          aria-controls={insightsPanelId}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div>
            <div className="text-sm font-semibold text-[color:var(--studio-ink)]">
              Detailed session view
            </div>
            <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
              Extra detail for facilitators, including follow-up chains, logs, and session trace.
            </div>
          </div>
          <ChevronDown
            className={[
              "h-4 w-4 shrink-0 text-[color:var(--studio-muted2)] transition-transform",
              advancedInsightsOpen ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>
      </div>

      {advancedInsightsOpen ? (
      <div className="flex flex-wrap gap-2 text-xs text-[color:var(--studio-muted2)]">
        <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2.5 py-1">
          <kbd className="font-semibold text-foreground">c</kbd> Toggle COP
        </span>
        <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2.5 py-1">
          <kbd className="font-semibold text-foreground">d</kbd> Toggle detailed view
        </span>
        <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2.5 py-1">
          <kbd className="font-semibold text-foreground">Esc</kbd> Close panels
        </span>
      </div>
      ) : null}

      {advancedInsightsOpen ? (
      <div id={insightsPanelId} className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
        <div className="flex items-center justify-between border-b border-[var(--studio-border)] px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
              <Sparkles className="h-4 w-4 opacity-80" />
              Session activity
              <HintTooltip text="A compact readout of what the session is generating and where team attention is building up." />
            </div>
          </div>
          <div className="text-xs text-[color:var(--studio-muted2)]">
            {latestConsequence ? `Latest at ${fmt(latestConsequence.applied_at)}` : "Waiting for first development"}
          </div>
        </div>

        <div className="grid gap-3 p-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[18px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] p-4 shadow-[0_12px_28px_hsl(220_20%_20%/0.03)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
              Current pressure
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <div className="text-2xl font-semibold tracking-tight">{openTasks.length}</div>
                <div className="text-xs text-[color:var(--studio-muted2)]">Open follow-ups</div>
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight">{overdueTaskCount}</div>
                <div className="text-xs text-[color:var(--studio-muted2)]">Overdue</div>
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight">{consequences.length}</div>
                <div className="text-xs text-[color:var(--studio-muted2)]">Developments</div>
              </div>
            </div>
            <div className="mt-4 text-sm text-[color:var(--studio-muted)]">
              {overdueTaskCount > 0
                ? "The session is carrying overdue follow-up work. Clear the oldest tasks first to reduce repeated escalation."
                : openTasks.length > 0
                ? "Follow-up work is active but still inside its current window."
                : "No active pressure is building right now."}
            </div>
          </div>

          <div className="rounded-[18px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] p-4 shadow-[0_12px_28px_hsl(220_20%_20%/0.03)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
              Latest development
            </div>
            {latestConsequence ? (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={[
                      "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase",
                      consequenceSeverityTone(latestConsequence.severity),
                    ].join(" ")}
                  >
                    {latestConsequence.severity}
                  </span>
                  <span className="text-xs text-[color:var(--studio-muted2)]">
                    {consequenceTypeLabel(latestConsequence)}
                  </span>
                </div>
                <div className="mt-3 font-medium">{latestConsequence.title}</div>
                <div className="mt-1 text-sm text-[color:var(--studio-muted)]">
                  {latestConsequence.description ?? "A new session development was added without extra detail."}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--studio-muted2)]">
                  {latestConsequence.task_id ? <span>Has follow-up</span> : null}
                  {latestConsequence.decision_id ? <span>Decision related</span> : null}
                  {latestConsequence.session_inject_id ? <span>Update related</span> : null}
                </div>
              </>
            ) : (
              <div className="mt-3 text-sm text-[color:var(--studio-muted2)]">
                No follow-on developments yet. Release an update or record a decision to start the chain.
              </div>
            )}
          </div>
        </div>
      </div>
      ) : null}

      {advancedInsightsOpen ? (
      <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-[var(--studio-border)] bg-[color:var(--studio-surface)] px-4 py-3">
        <button
          type="button"
          onClick={() =>
            setSelectedThreadOnly((value) => {
              const next = !value;
              if (!next) setFocusedThreadId(null);
              else if (!focusedThreadId && selectedItem?.id) setFocusedThreadId(selectedItem.id);
              return next;
            })
          }
          aria-pressed={selectedThreadOnly}
          className={[
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            selectedThreadOnly
              ? "border-primary/30 bg-primary/10 text-[color:var(--studio-ink)]"
              : "border-[var(--studio-border)] bg-[color:var(--studio-surface2)] text-[color:var(--studio-muted2)]",
          ].join(" ")}
        >
          {selectedThreadOnly ? "Focused chain only" : "Show all chains"}
        </button>
        <button
          type="button"
          onClick={() => setRuntimeTasksOnly((value) => !value)}
          aria-pressed={runtimeTasksOnly}
          className={[
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            runtimeTasksOnly
              ? "border-primary/30 bg-primary/10 text-[color:var(--studio-ink)]"
              : "border-[var(--studio-border)] bg-[color:var(--studio-surface2)] text-[color:var(--studio-muted2)]",
          ].join(" ")}
        >
          {runtimeTasksOnly ? "Auto-created only" : "All follow-ups"}
        </button>
        <div className="text-xs text-[color:var(--studio-muted2)] sm:ml-auto">
          {selectedThreadOnly
            ? activeThreadId
              ? "Focused on the update chain you selected from the feed or timeline."
              : "Select a message or timeline event to narrow the view to one chain."
          : "Showing the broader session picture."}
        </div>
      </div>
      ) : null}

      {advancedInsightsOpen ? (
      <div className={isMobile ? "grid grid-cols-1 gap-4" : "grid grid-cols-12 gap-4"}>
        <div className={isMobile ? "" : "col-span-4"}>
          <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
            <div className="flex items-center justify-between border-b border-[var(--studio-border)] px-4 py-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
                  <CheckSquare className="h-4 w-4 opacity-80" />
                  Decision tracker
                  <HintTooltip text="Responses and decisions create follow-up work here so it is easier to see what still needs attention." />
                </div>
              </div>
              <div className="text-xs text-[color:var(--studio-muted2)]">
                {`${visibleTasks.length} shown • ${visibleDecisions.length} decisions`}
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4 flex flex-wrap gap-2 text-xs text-[color:var(--studio-muted2)]">
                <span className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2.5 py-1">
                  {visibleTasks.length} shown
                </span>
                <span className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2.5 py-1">
                  {visibleTasks.filter((task) => task.status === "in_progress").length} in progress
                </span>
                {visibleTasks.some((task) => task.due_at && new Date(task.due_at).getTime() <= Date.now() && task.status !== "done" && task.status !== "cancelled") ? (
                  <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-red-300">
                    Overdue work needs attention
                  </span>
                ) : null}
              </div>
              <div className="space-y-3">
                {visibleTasks.length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-4 py-5 text-sm text-[color:var(--studio-muted2)]">
                    No active follow-up tasks yet.
                  </div>
                ) : (
                  visibleTasks.slice(0, 8).map((task) => (
                    <div
                      key={task.id}
                      className={[
                        "rounded-[18px] border bg-[color:var(--studio-surface2)] px-4 py-4 shadow-[0_10px_24px_hsl(220_20%_20%/0.03)]",
                        task.due_at && new Date(task.due_at).getTime() <= Date.now() && task.status !== "done" && task.status !== "cancelled"
                          ? "border-red-500/25"
                          : "border-[var(--studio-border)]",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">{task.title}</div>
                          {task.description ? (
                            <div className="mt-1 text-sm text-[color:var(--studio-muted)]">
                              {task.description}
                            </div>
                          ) : null}
                        </div>
                        <span
                          className={[
                            "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase",
                            taskPriorityTone(task.priority),
                          ].join(" ")}
                        >
                          {task.priority}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--studio-border)] pt-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--studio-muted2)]">
                          <span
                            className={[
                              "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase",
                              taskStatusTone(task.status),
                            ].join(" ")}
                          >
                            {task.status.replaceAll("_", " ")}
                          </span>
                          {task.due_at && new Date(task.due_at).getTime() <= Date.now() && task.status !== "done" && task.status !== "cancelled" ? (
                            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 font-semibold text-red-300">
                              Overdue
                            </span>
                          ) : null}
                          <span>{task.assigned_role ? `Owner: ${task.assigned_role}` : "No owner yet"}</span>
                          {task.due_at ? <span>{`Due ${fmt(task.due_at)}`}</span> : null}
                          {task.decision_id ? <span>Decision related</span> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {task.status !== "in_progress" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={taskBusyId === task.id}
                              onClick={() => handleTaskStatus(task.id, "in_progress")}
                            >
                              Start
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={taskBusyId === task.id}
                            onClick={() => handleTaskStatus(task.id, "done")}
                          >
                            Done
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={isMobile ? "" : "col-span-4"}>
          <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
            <div className="flex items-center justify-between border-b border-[var(--studio-border)] px-4 py-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
                  <Sparkles className="h-4 w-4 opacity-80" />
                  Session developments
                  <HintTooltip text="Automatic developments appear here when the session adds pressure, follow-up work, or a new turn in the scenario." />
                </div>
              </div>
              <div className="text-xs text-[color:var(--studio-muted2)]">
                {`${visibleConsequences.length} shown`}
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4 flex flex-wrap gap-2 text-xs text-[color:var(--studio-muted2)]">
                <span className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2.5 py-1">
                  {visibleConsequences.length} shown
                </span>
                <span className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2.5 py-1">
                  {visibleConsequences.filter((item) => item.task_id).length} with follow-up
                </span>
                {visibleConsequences[0] ? (
                  <span className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2.5 py-1">
                    Latest {fmt(visibleConsequences[0].applied_at)}
                  </span>
                ) : null}
              </div>
              <div className="space-y-3">
                {visibleConsequences.length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-4 py-5 text-sm text-[color:var(--studio-muted2)]">
                    No automatic developments yet.
                  </div>
                ) : (
                  visibleConsequences.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[18px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-4 py-4 shadow-[0_10px_24px_hsl(220_20%_20%/0.03)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">{item.title}</div>
                          {item.description ? (
                            <div className="mt-1 text-sm text-[color:var(--studio-muted)]">
                              {item.description}
                            </div>
                          ) : null}
                        </div>
                        <span
                          className={[
                            "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase",
                            consequenceSeverityTone(item.severity),
                          ].join(" ")}
                        >
                          {item.severity}
                        </span>
                      </div>

                      <div className="mt-3 text-xs text-[color:var(--studio-muted2)]">
                        {consequenceTypeLabel(item)} • {fmt(item.applied_at)}
                      </div>

                      <div className="mt-2 text-sm font-medium text-[color:var(--studio-ink)]">
                        {consequenceImpactLabel(item)}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--studio-border)] pt-3 text-xs text-[color:var(--studio-muted2)]">
                        {item.task_id ? <span>Created or matched task</span> : null}
                        {item.decision_id ? <span>Decision related</span> : null}
                        {item.session_inject_id ? <span>Update related</span> : null}
                        {item.rule_template_id ? <span>Created automatically</span> : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={isMobile ? "" : "col-span-4"}>
          <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
            <div className="flex items-center justify-between border-b border-[var(--studio-border)] px-4 py-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
                  <ListChecks className="h-4 w-4 opacity-80" />
                  Response log
                  <HintTooltip text="This log shows visible team responses and facilitator decisions during the exercise." />
                </div>
              </div>
              <div className="text-xs text-[color:var(--studio-muted2)]">
                {actionsLoading
                  ? "Loading…"
                  : actionsError
                  ? actionsError
                  : `${visibleActions.length} shown`}
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4 flex flex-wrap gap-2 text-xs text-[color:var(--studio-muted2)]">
                <span className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2.5 py-1">
                  {visibleActions.length} shown
                </span>
                <span className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2.5 py-1">
                  {visibleActions.filter((action) => action.action_type === "escalate").length} escalations
                </span>
                <span className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2.5 py-1">
                  {visibleActions.filter((action) => action.action_type === "act").length} actioned
                </span>
              </div>
              <div className="space-y-2.5">
                {actionsLoading ? (
                  <div className="text-sm text-[color:var(--studio-muted2)]">
                    Loading…
                  </div>
                ) : visibleActions.length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-4 py-5 text-sm text-[color:var(--studio-muted2)]">
                    No responses yet.
                  </div>
                ) : (
                  visibleActions.slice(0, 30).map((a) => (
                    <div
                      key={a.id}
                      className="rounded-[18px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-4 py-4 shadow-[0_10px_24px_hsl(220_20%_20%/0.03)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-[color:var(--studio-muted2)]">
                          {fmt(a.created_at)}
                        </div>
                        <div className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--studio-ink)]">
                          {humanActionLabel(a.action_type)}
                        </div>
                      </div>
                      {a.comment ? (
                        <div className="mt-1 text-sm">{a.comment}</div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {advancedInsightsOpen ? (
      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
        <div className="flex items-center justify-between border-b border-[var(--studio-border)] px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
              <Sparkles className="h-4 w-4 opacity-80" />
              Chain of events
              <HintTooltip text="A connected view of updates, responses, decisions, developments, and follow-up work for the current session." />
            </div>
          </div>
          <div className="text-xs text-[color:var(--studio-muted2)]">
            {selectedThreadOnly ? "Focused chain" : "Full session chain"}
          </div>
        </div>

        <div className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[color:var(--studio-muted2)]">
            <span className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2.5 py-1">
              {chainEvents.length} visible events
            </span>
            {selectedTimelinePathEvents.length > 0 ? (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.045] px-2.5 py-1 font-semibold text-emerald-800 dark:text-emerald-300">
                {selectedTimelinePathEvents.length} linked in selected path
              </span>
            ) : null}
            {selectedThreadOnly ? (
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 font-semibold text-[color:var(--studio-ink)]">
                Focused chain mode
              </span>
            ) : null}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(["15m", "60m", "all"] as TimelineWindow[]).map((window) => (
              <button
                key={window}
                type="button"
                onClick={() => setTimelineWindow(window)}
                aria-pressed={timelineWindow === window}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase transition",
                  timelineWindow === window
                    ? "border-primary/30 bg-primary/10 text-[color:var(--studio-ink)]"
                    : "border-[var(--studio-border)] bg-[color:var(--studio-surface2)] text-[color:var(--studio-muted2)]",
                ].join(" ")}
              >
                {window}
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {(["inject", "action", "decision", "consequence", "task"] as TimelineKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => toggleTimelineKind(kind)}
                aria-pressed={timelineFilter[kind]}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition",
                  timelineFilter[kind]
                    ? "border-primary/30 bg-primary/10 text-[color:var(--studio-ink)]"
                    : "border-[var(--studio-border)] bg-[color:var(--studio-surface2)] text-[color:var(--studio-muted2)]",
                ].join(" ")}
              >
                {kind}
              </button>
            ))}
            {selectedTimelineEventId ? (
              <button
                type="button"
                onClick={() => setSelectedTimelineEventId(null)}
                className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-3 py-1.5 text-xs font-semibold text-[color:var(--studio-muted2)] transition hover:border-[var(--studio-border-strong)] hover:text-[color:var(--studio-ink)]"
              >
                Clear selected path
              </button>
            ) : null}
          </div>

          {selectedTimelinePathEvents.length > 0 ? (
            <div className="mb-4 rounded-[18px] border border-emerald-500/20 bg-emerald-500/[0.045] px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-500/20 bg-[color:var(--studio-surface2)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-800 dark:text-emerald-300">
                  Selected path
                </span>
                <span className="text-sm text-[color:var(--studio-muted)]">
                  {selectedTimelinePathEvents.length} linked events
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--studio-muted2)]">
                {selectedTimelinePathEvents.map((event, index) => (
                  <React.Fragment key={`summary:${event.id}`}>
                    <span className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2.5 py-1 font-medium text-[color:var(--studio-ink)]">
                      {compactLabel(event.title, event.kind)}
                    </span>
                    {index < selectedTimelinePathEvents.length - 1 ? (
                      <span className="text-emerald-700/70 dark:text-emerald-300/70">→</span>
                    ) : null}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : null}

          {chainEvents.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-4 py-5 text-sm text-[color:var(--studio-muted2)]">
              No linked events to show yet.
            </div>
          ) : (
            <div className="space-y-5">
              {groupedChainEvents.map((group) => (
                <div key={group.label} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)] backdrop-blur">
                      {group.label}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => scrollTimeline(group.label, "left")}
                        title="Scroll timeline left"
                        aria-label={`Scroll timeline left for ${group.label}`}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => scrollTimeline(group.label, "right")}
                        title="Scroll timeline right"
                        aria-label={`Scroll timeline right for ${group.label}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div data-timeline-group={group.label} className="relative overflow-x-auto pb-2 pt-8 snap-x snap-mandatory">
                    <div className="pointer-events-none absolute left-0 right-0 top-[46px] h-px bg-[linear-gradient(90deg,hsl(210_20%_86%),hsl(220_30%_78%),hsl(210_20%_86%))]" />
                    <div className="flex min-w-max items-start gap-3 pr-4">
                      {group.items.map((event, index) => {
                        const isActiveThreadEvent =
                          activeThreadId != null && event.sessionInjectId === activeThreadId;
                        const isHoveredThreadEvent =
                          hoveredThreadId != null && event.sessionInjectId === hoveredThreadId;
                        const isSelectedPathEvent =
                          selectedTimelineEventId != null && selectedTimelinePathIds.has(event.id);
                        const isMutedByHover =
                          hoveredThreadId != null &&
                          event.sessionInjectId != null &&
                          event.sessionInjectId !== hoveredThreadId;
                        const isMutedBySelection =
                          selectedTimelineEventId != null && !isSelectedPathEvent;
                        const nextEvent = group.items[index + 1] ?? null;
                        const connectorLabel = timelineConnectorLabel(event, nextEvent);
                        const isSelectedPathConnector =
                          nextEvent != null &&
                          selectedTimelineEventId != null &&
                          selectedTimelinePathIds.has(event.id) &&
                          selectedTimelinePathIds.has(nextEvent.id);
                        const shouldShowConnectorLabel =
                          Boolean(connectorLabel) &&
                          (isSelectedPathConnector || isHoveredThreadEvent || isActiveThreadEvent);
                        const hasThreadContinuation =
                          event.sessionInjectId != null &&
                          nextEvent?.sessionInjectId != null &&
                          event.sessionInjectId === nextEvent.sessionInjectId;
                        return (
                          <div
                            key={event.id}
                            className={[
                              "relative w-[240px] min-w-[240px] snap-start space-y-3 transition-opacity",
                              isMutedByHover ? "opacity-45" : isMutedBySelection ? "opacity-55" : "opacity-100",
                            ].join(" ")}
                          >
                            {hasThreadContinuation ? (
                              <div className="pointer-events-none absolute left-full top-[-8px] z-0 w-28">
                                {shouldShowConnectorLabel ? (
                                  <div
                                    className={[
                                      "mb-2 inline-flex max-w-[118px] rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm",
                                      isSelectedPathConnector
                                        ? "border-emerald-500/25 bg-[color:var(--studio-surface2)] text-emerald-800 dark:text-emerald-300"
                                        : isHoveredThreadEvent || isActiveThreadEvent
                                        ? "border-primary/25 bg-[color:var(--studio-surface2)] text-[color:var(--studio-ink)]"
                                        : "border-orange-500/20 bg-[color:var(--studio-surface2)] text-orange-800 dark:text-orange-300",
                                    ].join(" ")}
                                  >
                                    {connectorLabel}
                                  </div>
                                ) : null}
                                <div
                                  className={[
                                    "h-[2px] w-12",
                                    isSelectedPathConnector
                                      ? "bg-[linear-gradient(90deg,hsl(160_84%_39%/0.85),hsl(160_84%_39%/0.18))]"
                                      : isHoveredThreadEvent || isActiveThreadEvent
                                      ? "bg-[linear-gradient(90deg,hsl(220_90%_56%/0.85),hsl(220_90%_56%/0.2))]"
                                      : shouldShowConnectorLabel
                                      ? "bg-[linear-gradient(90deg,hsl(25_95%_55%/0.65),hsl(25_95%_55%/0.1))]"
                                      : "bg-[linear-gradient(90deg,hsl(220_90%_56%/0.55),hsl(220_90%_56%/0.12))]",
                                  ].join(" ")}
                                />
                              </div>
                            ) : null}
                            <div className="flex items-center gap-2 px-1">
                              <div
                                className={[
                                  "h-3 w-3 rounded-full border-2 bg-[color:var(--studio-surface2)]",
                                  isSelectedPathEvent
                                    ? "border-emerald-500"
                                    : isActiveThreadEvent || isHoveredThreadEvent
                                    ? "border-primary"
                                    : "border-[var(--studio-border-strong)]",
                                ].join(" ")}
                              />
                              <div className="text-xs font-semibold text-[color:var(--studio-muted2)]">
                                {fmt(event.at)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => focusTimelineEvent(event.sessionInjectId, event.id)}
                              onMouseEnter={() => setHoveredThreadId(event.sessionInjectId)}
                              onMouseLeave={() => setHoveredThreadId((current) => (current === event.sessionInjectId ? null : current))}
                              aria-pressed={isSelectedPathEvent || isActiveThreadEvent}
                              className={[
                                "relative min-h-[154px] w-full rounded-[18px] border px-4 py-3 text-left transition",
                                isSelectedPathEvent
                                  ? "border-emerald-500/35 bg-emerald-500/[0.045] shadow-[0_0_0_1px_hsl(160_84%_39%/0.08)]"
                                  : isActiveThreadEvent
                                  ? "border-primary/35 bg-primary/10 shadow-[0_0_0_1px_hsl(220_90%_56%/0.08)]"
                                  : isHoveredThreadEvent
                                  ? "border-primary/25 bg-primary/[0.03] shadow-[0_10px_30px_hsl(220_70%_55%/0.08)]"
                                  : "border-[var(--studio-border)] bg-[color:var(--studio-surface2)] hover:border-[var(--studio-border-strong)] hover:bg-[color:var(--studio-surface)]",
                              ].join(" ")}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={[
                                    "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase",
                                    eventTone(event.kind),
                                  ].join(" ")}
                                >
                                  {event.kind}
                                </span>
                                {isActiveThreadEvent ? (
                                  <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-[color:var(--studio-ink)]">
                                    Active thread
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-3 font-medium leading-snug">{event.title}</div>
                              <div className="mt-1.5 line-clamp-3 text-sm leading-6 text-[color:var(--studio-muted)]">
                                {event.detail}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {event.meta.map((meta) => (
                                  <span
                                    key={`${event.id}:${meta}`}
                                    className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2 py-0.5 text-[11px] text-[color:var(--studio-muted2)]"
                                  >
                                    {meta}
                                  </span>
                                ))}
                              </div>
                              {event.relations.length > 0 ? (
                                <div className="mt-3 border-t border-[var(--studio-border)] pt-3">
                                  <div className="flex flex-wrap gap-1.5">
                                    {event.relations.map((relation) => (
                                      <span
                                        key={`${event.id}:rel:${relation.label}`}
                                        className={[
                                          "rounded-full px-2 py-0.5 text-[11px]",
                                          relation.emphasis === "primary"
                                            ? "border border-primary/20 bg-primary/10 text-[color:var(--studio-ink)]"
                                            : "border border-[var(--studio-border)] bg-[color:var(--studio-surface)] text-[color:var(--studio-muted2)]",
                                        ].join(" ")}
                                      >
                                        {relation.label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              {event.sessionInjectId ? (
                                <div className="mt-4 text-[11px] font-medium text-[color:var(--studio-muted2)]">
                                  Focus this update chain
                                </div>
                              ) : null}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      ) : null}
    </div>
  );
}
