// app/(app)/sessions/[id]/page.tsx
"use client";

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import {
  type Scenario,
  type ScenarioRole,
  listScenarioRoles,
} from "@/lib/scenarios";
import { getErrorMessage } from "@/lib/errors";

import {
  getSessionSituation,
  updateCasualties,
  updateSessionManifest,
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

import SessionFeedAndDetail from "@/app/components/session-runtime/SessionFeedAndDetail";
import SessionHeaderPanel from "@/app/components/session-runtime/SessionHeaderPanel";
import SessionParticipantBoards from "@/app/components/session-runtime/SessionParticipantBoards";
import { useRoleContext } from "@/app/components/useRoleContext";
import {
  consequenceImpactLabel,
  consequenceSeverityTone,
  consequenceTypeLabel,
  decisionPressureLabel,
  fmt,
  humanActionLabel,
  humanDecisionLabel,
  isEditableTarget,
  isUuid,
  taskPriorityTone,
  taskStatusTone,
  useMediaQuery,
} from "@/app/components/session-runtime/sessionRuntimeUi";

import { Button } from "@/app/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Sparkles,
  ListChecks,
  CheckSquare,
  MessagesSquare,
  Wrench,
  X,
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

function onboardingKey(sessionId: string) {
  return `decisionary.onboarding.dismissed.${sessionId}`;
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

function roleNameFromKey(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function dueAtFromPreset(value: string) {
  if (value === "none") return null;
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function responseTargetLabel(action: SessionAction) {
  const stream = action.source === "pulse" ? "Pulse" : "Inbox";
  const rawTitle = action.inject_title?.trim();
  const title = rawTitle
    ? rawTitle.length > 44
      ? `${rawTitle.slice(0, 41)}...`
      : rawTitle
    : null;
  if (title) return `${stream}: ${title}`;
  return `${stream} update`;
}

function responseDecisionLabel(
  action: SessionAction,
  decisionType: string | null | undefined,
  followUpCount: number
) {
  if (decisionType === "confirm") return "Confirmed claim";
  if (decisionType === "deny") return "Dismissed claim";
  if (action.action_type === "escalate") return "Escalated issue";
  if (followUpCount > 0) return followUpCount === 1 ? "Created follow-up" : `Created ${followUpCount} follow-ups`;
  if (action.action_type === "act") return "Recorded action";
  if (action.action_type === "ignore") return "Monitoring only";
  return "Recorded response";
}

export default function SessionParticipantPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ?? "";
  const validSessionId = useMemo(() => isUuid(sessionId), [sessionId]);
  const { activeRole, loading: roleContextLoading } = useRoleContext();

  const isMobile = useMediaQuery("(max-width: 1100px)");
  const copPanelId = useId();
  const toolsPanelId = useId();
  const updatesPanelId = useId();
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
  const [copOpen, setCopOpen] = useState(true);
  const [updatesOpen, setUpdatesOpen] = useState(true);
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
  const [scenarioRoles, setScenarioRoles] = useState<ScenarioRole[]>([]);
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
  const [taskOwnerRole, setTaskOwnerRole] = useState("facilitator");
  const [taskDuePreset, setTaskDuePreset] = useState("15");
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  // Facilitator tools popover
  const [toolsOpen, setToolsOpen] = useState(false);
  const [advancedInsightsOpen, setAdvancedInsightsOpen] = useState(false);

  // Unseen badges
  const [unseenInbox, setUnseenInbox] = useState(0);
  const [unseenPulse, setUnseenPulse] = useState(0);

  const sessionTitle = scenario?.title ? scenario.title : "Session";
  const totalWaitingUpdates = unseenInbox + unseenPulse;
  const facilitatorSessionAccess = isFacilitator;
  const participantViewMode = !roleContextLoading && activeRole === "participant";
  const canUseFacilitatorUi = facilitatorSessionAccess && !participantViewMode;
  const allPrimaryPanelsClosed =
    !copOpen &&
    !updatesOpen &&
    (!canUseFacilitatorUi || (!toolsOpen && !advancedInsightsOpen));

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

  function hasRuntimeChanges(
    result: { created_consequences: number; created_tasks: number; created_injects: number } | null
  ) {
    if (!result) return false;
    return result.created_consequences + result.created_tasks + result.created_injects > 0;
  }

  useEffect(() => {
    if (!runtimeNotice) return;
    const timer = window.setTimeout(() => setRuntimeNotice(null), 5_000);
    return () => window.clearTimeout(timer);
  }, [runtimeNotice]);

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
        setScenarioRoles([]);
        return;
      }

      const [
        { data: sc, error: scErr },
        roles,
      ] = await Promise.all([
        supabase
          .from("scenarios")
          .select("*")
          .eq("id", scenarioId)
          .maybeSingle(),
        listScenarioRoles(scenarioId),
      ]);

      if (scErr) throw scErr;

      setScenario((sc as Scenario | null) ?? null);
      setScenarioRoles(roles);
    } catch (e: unknown) {
      setScenario(null);
      setScenarioRoles([]);
      setError(
        (prev) =>
          prev ??
          (e instanceof Error
            ? `Scenario/meta load: ${e.message}`
            : "Scenario/meta load failed")
      );
    }
  }

  const getSeen = useCallback((kind: "inbox" | "pulse") => {
    const raw =
      typeof window !== "undefined"
        ? localStorage.getItem(lsKey(sessionId, kind))
        : null;
    const dt = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(dt) ? dt : 0;
  }, [sessionId]);

  const markSeen = useCallback((kind: "inbox" | "pulse") => {
    const nowIso = new Date().toISOString();
    localStorage.setItem(lsKey(sessionId, kind), nowIso);
    if (kind === "inbox") setUnseenInbox(0);
    if (kind === "pulse") setUnseenPulse(0);
  }, [sessionId]);

  const refreshUnseen = useCallback(async () => {
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
      .select("id, injects:inject_id!inner(channel)", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .gte("delivered_at", inboxSince)
      .eq("injects.channel", "pulse");

    const { count: internalNewForInbox } = await supabase
      .from("session_injects")
      .select("id, injects:inject_id!inner(source_type)", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .gte("delivered_at", inboxSince)
      .in("injects.source_type", ["conditional", "consequence"]);

    const inboxNew = Math.max(
      0,
      (totalNewInbox ?? 0) - (pulseNewForInbox ?? 0) - (internalNewForInbox ?? 0)
    );
    setUnseenInbox(inboxNew);

    const { count: pulseNew } = await supabase
      .from("session_injects")
      .select("id, injects:inject_id!inner(channel, source_type)", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .gte("delivered_at", pulseSince)
      .eq("injects.channel", "pulse");

    const { count: internalPulse } = await supabase
      .from("session_injects")
      .select("id, injects:inject_id!inner(channel, source_type)", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .gte("delivered_at", pulseSince)
      .eq("injects.channel", "pulse")
      .in("injects.source_type", ["conditional", "consequence"]);

    setUnseenPulse(Math.max(0, (pulseNew ?? 0) - (internalPulse ?? 0)));
  }, [getSeen, sessionId, validSessionId]);

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

  useEffect(() => {
    if (typeof window === "undefined" || !validSessionId) return;
    setOnboardingDismissed(window.sessionStorage.getItem(onboardingKey(sessionId)) === "1");
  }, [sessionId, validSessionId]);

  useEffect(() => {
    if (typeof window === "undefined" || !validSessionId) return;
    if (actions.length > 0 && !onboardingDismissed) {
      window.sessionStorage.setItem(onboardingKey(sessionId), "1");
      setOnboardingDismissed(true);
    }
  }, [actions.length, onboardingDismissed, sessionId, validSessionId]);

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
        const wrap = filtersWrapRef.current;
        const panel = filtersPanelRef.current;
        if (
          e.target instanceof Node &&
          wrap &&
          !wrap.contains(e.target) &&
          !(panel && panel.contains(e.target))
        ) {
          setFiltersOpen(false);
        }
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

      if (key === "t" && canUseFacilitatorUi) {
        e.preventDefault();
        setToolsOpen((value) => !value);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canUseFacilitatorUi, markSeen, refreshUnseen]);

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
          if (hasRuntimeChanges(result)) {
            await refreshDecisionBoard();
          }
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
      ? "Rehearsal"
      : "Session";
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

  const decisionsByActionId = useMemo(() => {
    const map = new Map<string, SessionDecision>();
    for (const decision of visibleDecisions) {
      if (decision.action_id) map.set(decision.action_id, decision);
    }
    return map;
  }, [visibleDecisions]);

  const tasksBySourceActionId = useMemo(() => {
    const map = new Map<string, SessionTask[]>();
    for (const task of visibleTasks) {
      if (!task.source_action_id) continue;
      const current = map.get(task.source_action_id) ?? [];
      current.push(task);
      map.set(task.source_action_id, current);
    }
    return map;
  }, [visibleTasks]);

  const notableActions = useMemo(() => {
    return visibleActions.filter((action) => {
      const linkedDecision = decisionsByActionId.get(action.id);
      const linkedTasks = tasksBySourceActionId.get(action.id) ?? [];
      const hasComment = Boolean(action.comment?.trim());
      const hasMeaningfulDecision =
        linkedDecision?.decision_type === "confirm" || linkedDecision?.decision_type === "deny";

      if (action.action_type === "escalate") return true;
      if (linkedTasks.length > 0) return true;
      if (hasComment) return true;
      if (hasMeaningfulDecision) return true;
      if (action.source === "pulse" && action.action_type === "act") return true;
      return false;
    });
  }, [visibleActions, decisionsByActionId, tasksBySourceActionId]);

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
          selectedItem.injects?.channel === "pulse" ? "Stream Pulse" : "Stream Inbox",
          selectedItem.injects?.severity
            ? `Pressure ${decisionPressureLabel(selectedItem.injects.severity)}`
            : "No pressure tag",
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
          if (hasRuntimeChanges(result)) {
            await refreshDecisionBoard();
          }
          setRuntimeNoticeFromResult(result);
        } catch {
          // ignore periodic runtime evaluation errors
        }
      })();
    };

    checkOverdueTasks();
    const intervalId = window.setInterval(checkOverdueTasks, 30_000);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const assignedRole = actionType === "escalate" ? taskOwnerRole.trim() || null : "facilitator";
        const dueAt = actionType === "escalate" ? dueAtFromPreset(taskDuePreset) : null;
        const task = await createSessionTask({
          sessionId,
          sessionInjectId: selectedItem.id,
          decisionId: savedDecision.id,
          sourceActionId: saved.id,
          assignedRole,
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
          dueAt,
        });
        setTasks((prev) => [task, ...prev]);
        setRuntimeNotice(
          actionType === "escalate"
            ? `Escalation task created${assignedRole ? ` for ${roleNameFromKey(assignedRole)}` : ""}${dueAt ? `, due ${fmt(dueAt)}` : ""}.`
            : `Decision recorded and follow-through task created${dueAt ? `, due ${fmt(dueAt)}` : ""}.`
        );
      }

      if (actionType === "act" && !requiresDecision) {
        setRuntimeNotice("Decision recorded.");
      }

      const runtimeResult = await evaluateSessionRules({
        sessionId,
        eventType: "decision_recorded",
        sessionInjectId: selectedItem.id,
        decisionId: savedDecision.id,
        actionId: saved.id,
        source: selectedSource,
      });
      if (hasRuntimeChanges(runtimeResult)) {
        await refreshDecisionBoard();
      }
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

      await sendInjectToSession(sessionId, title, body, {
        source_type: "conditional",
      });
      const runtimeResult = await evaluateSessionRules({
        sessionId,
        eventType: "decision_recorded",
        sessionInjectId: selectedItem.id,
        decisionId: savedDecision.id,
        actionId: saved.id,
        source: "pulse",
      });
      if (hasRuntimeChanges(runtimeResult)) {
        await refreshDecisionBoard();
      }
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
      const runtimeResult = await evaluateSessionRules({
        sessionId,
        eventType: "task_status_changed",
        taskId: updated.id,
      });
      if (runtimeResult.created_consequences || runtimeResult.created_tasks || runtimeResult.created_injects) {
        await refreshDecisionBoard();
        setRuntimeNoticeFromResult(runtimeResult);
      } else {
        setRuntimeNotice(`Task marked as ${status.replaceAll("_", " ")}.`);
      }
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
  }

  function clearPulseFilters() {
    setPulseSearch("");
    setPulseSeverity(null);
  }

  const inboxFiltersActive =
    Boolean(inboxSearch.trim()) ||
    Boolean(inboxSeverity);
  const pulseFiltersActive =
    Boolean(pulseSearch.trim()) || Boolean(pulseSeverity);
  const taskRoleOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];
    const add = (value: string, label: string) => {
      const normalized = value.trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      options.push({ value: normalized, label });
    };

    add("facilitator", "Facilitator");
    scenarioRoles.forEach((role) => {
      add(role.role_key, role.role_name?.trim() || roleNameFromKey(role.role_key));
    });

    if (!seen.has(taskOwnerRole)) {
      add(taskOwnerRole, roleNameFromKey(taskOwnerRole));
    }

    return options;
  }, [scenarioRoles, taskOwnerRole]);
  const participantVisibleTasks = visibleTasks.slice(0, 5);
  const suggestedTaskId = participantVisibleTasks[0]?.id ?? null;
  const participantFocusText = selectedItem
    ? selectedItem.injects?.requires_decision
      ? "Review the selected update and decide how your team should respond."
      : "Review the selected update and choose the next clear step."
    : "Choose an update from the feed to see what needs your attention.";
  const sessionJustStarted =
    !startedAt ||
    (typeof startedAt === "string" &&
      Number.isFinite(new Date(startedAt).getTime()) &&
      Date.now() - new Date(startedAt).getTime() <= 10 * 60_000);
  const showStartHelper =
    canUseFacilitatorUi &&
    !onboardingDismissed &&
    sessionJustStarted &&
    actions.length === 0 &&
    openTasks.length === 0 &&
    consequences.length === 0;
  const nextBestAction = canUseFacilitatorUi
    ? showStartHelper
      ? "Release or wait for the first inject, then guide the team through one response."
      : overdueTaskCount > 0
      ? "Clear the oldest overdue follow-up before adding more pressure."
      : totalWaitingUpdates > 0
      ? "Pick one update from the feed and decide whether to monitor, escalate, or act."
      : sessionMode === "rehearsal"
      ? "Use facilitator tools to release the next inject and continue the dry run."
      : null
    : totalWaitingUpdates > 0
    ? "Open one update from the feed and decide what your team should do next."
    : null;

  useEffect(() => {
    if (!canUseFacilitatorUi) {
      setToolsOpen(false);
      setAdvancedInsightsOpen(false);
    }
  }, [canUseFacilitatorUi]);

  useEffect(() => {
    if (!updatesOpen) setFiltersOpen(false);
  }, [updatesOpen]);

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
      <SessionHeaderPanel
        copPanelId={copPanelId}
        updatesPanelId={updatesPanelId}
        toolsPanelId={toolsPanelId}
        insightsPanelId={insightsPanelId}
        heroEyebrow={heroEyebrow}
        participantView={participantViewMode}
        startedAt={startedAt}
        sessionTitle={sessionTitle}
        nextBestAction={nextBestAction}
        sessionMode={sessionMode}
        sessionParticipantLimit={sessionParticipantLimit}
        copOpen={copOpen}
        setCopOpen={setCopOpen}
        updatesOpen={updatesOpen}
        setUpdatesOpen={setUpdatesOpen}
        totalWaitingUpdates={totalWaitingUpdates}
        roleLoading={roleLoading || roleContextLoading}
        isFacilitator={canUseFacilitatorUi}
        toolsOpen={toolsOpen}
        setToolsOpen={setToolsOpen}
        advancedInsightsOpen={advancedInsightsOpen}
        setAdvancedInsightsOpen={setAdvancedInsightsOpen}
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
        onUpdateManifest={async (p) => {
          const s = await updateSessionManifest({
            sessionId,
            passengerCount: p.passengerCount,
            crewCount: p.crewCount,
            cargoWeightKg: p.cargoWeightKg,
            dangerousGoodsCount: p.dangerousGoodsCount,
            liveAnimalsCount: p.liveAnimalsCount,
          });
          setSituation(s);
        }}
        applySessionMeta={applySessionMeta}
      />

      {showStartHelper ? (
        <div className="ui-session-shell px-4 py-4 md:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-[color:var(--studio-ink)]">
                Start of session
              </div>
              <div className="max-w-3xl text-sm leading-6 text-[color:var(--studio-muted)]">
                Release or wait for the first inject, then record one clear response.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.sessionStorage.setItem(onboardingKey(sessionId), "1");
                }
                setOnboardingDismissed(true);
              }}
              className="self-start rounded-[8px] border border-[var(--studio-border)] p-1 text-[color:var(--studio-muted2)] transition hover:text-foreground"
              aria-label="Dismiss onboarding helper"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {updatesOpen ? (
        <div id={updatesPanelId}>
          <SessionFeedAndDetail
            isMobile={isMobile}
            participantView={participantViewMode}
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
            pulseSearch={pulseSearch}
            setPulseSearch={setPulseSearch}
            pulseSeverity={pulseSeverity}
            setPulseSeverity={setPulseSeverity}
            clearInboxFilters={clearInboxFilters}
            clearPulseFilters={clearPulseFilters}
            inboxFiltersActive={inboxFiltersActive}
            pulseFiltersActive={pulseFiltersActive}
            runtimeNotice={runtimeNotice}
            comment={comment}
            setComment={setComment}
            taskOwnerRole={taskOwnerRole}
            setTaskOwnerRole={setTaskOwnerRole}
            taskDuePreset={taskDuePreset}
            setTaskDuePreset={setTaskDuePreset}
            taskRoleOptions={taskRoleOptions}
            doAction={doAction}
            doPulseDecision={doPulseDecision}
            rightRailBelow={
              <SessionParticipantBoards
                participantView={participantViewMode}
                overdueTaskCount={overdueTaskCount}
                openTasks={openTasks}
                selectedItemExists={Boolean(selectedItem)}
                participantFocusText={participantFocusText}
                latestConsequence={latestConsequence}
                participantVisibleTasks={participantVisibleTasks}
                suggestedTaskId={suggestedTaskId}
                canManageTasks={canUseFacilitatorUi}
                taskBusyId={taskBusyId}
                handleTaskStatus={handleTaskStatus}
              />
            }
          />
        </div>
      ) : null}

      {allPrimaryPanelsClosed ? (
        <div className="ui-session-shell px-4 py-6 md:px-5">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-[var(--studio-border)] bg-[hsl(var(--background))] text-[color:var(--studio-muted2)]">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div className="mt-3 text-sm font-semibold text-[color:var(--studio-ink)]">
              Session panels are hidden
            </div>
            <div className="mt-1 max-w-xl text-sm leading-6 text-[color:var(--studio-muted)]">
              Open a panel to continue working with the operational picture, updates, tools, or detailed trace.
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="outline" className="gap-2 rounded-[8px]" onClick={() => setCopOpen(true)}>
                <LayoutDashboard className="h-4 w-4" />
                Open COP
              </Button>
              <Button variant="outline" className="gap-2 rounded-[8px]" onClick={() => setUpdatesOpen(true)}>
                <MessagesSquare className="h-4 w-4" />
                Open updates
              </Button>
              {canUseFacilitatorUi ? (
                <>
                  <Button variant="outline" className="gap-2 rounded-[8px]" onClick={() => setToolsOpen(true)}>
                    <Wrench className="h-4 w-4" />
                    Open tools
                  </Button>
                  <Button variant="outline" className="gap-2 rounded-[8px]" onClick={() => setAdvancedInsightsOpen(true)}>
                    <ListChecks className="h-4 w-4" />
                    Open details
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {advancedInsightsOpen ? (
      <div id={insightsPanelId} className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
                <Sparkles className="h-4 w-4 opacity-80" />
              Overview
              </div>
            </div>
          <div className="text-xs text-[color:var(--studio-muted2)]">
            {latestConsequence ? `Latest at ${fmt(latestConsequence.applied_at)}` : "Waiting for first development"}
          </div>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-border bg-background p-5 shadow-[0_10px_24px_hsl(220_20%_20%/0.03)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
              Right now
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <div className="text-3xl font-semibold tracking-tight text-foreground">{openTasks.length}</div>
                <div className="text-xs text-[color:var(--studio-muted2)]">Open follow-ups</div>
              </div>
              <div>
                <div className="text-3xl font-semibold tracking-tight text-foreground">{overdueTaskCount}</div>
                <div className="text-xs text-[color:var(--studio-muted2)]">Overdue</div>
              </div>
              <div>
                <div className="text-3xl font-semibold tracking-tight text-foreground">{consequences.length}</div>
                <div className="text-xs text-[color:var(--studio-muted2)]">Developments</div>
              </div>
            </div>
            <div className="mt-5 text-sm leading-6 text-[color:var(--studio-muted)]">
              {overdueTaskCount > 0
                ? "Overdue follow-up work is building up. Clear the oldest tasks first."
                : openTasks.length > 0
                ? "Follow-up work is active, but still manageable."
                : "Nothing urgent is building up right now."}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5 shadow-[0_10px_24px_hsl(220_20%_20%/0.03)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
              Latest development
            </div>
            {latestConsequence ? (
              <>
                <div className="mt-3 flex items-center gap-2">
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
                <div className="mt-4 font-semibold text-foreground">{latestConsequence.title}</div>
                <div className="mt-2 text-sm leading-6 text-[color:var(--studio-muted)]">
                  {latestConsequence.description ?? "A new session development was added without extra detail."}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--studio-muted2)]">
                  {latestConsequence.task_id ? <span>Has follow-up</span> : null}
                  {latestConsequence.decision_id ? <span>Decision related</span> : null}
                  {latestConsequence.session_inject_id ? <span>Update related</span> : null}
                </div>
              </>
            ) : (
              <div className="mt-4 text-sm leading-6 text-[color:var(--studio-muted)]">
                No follow-on developments yet. Release an update or record a decision to start the chain.
              </div>
            )}
          </div>
        </div>
      </div>
      ) : null}

      {advancedInsightsOpen ? (
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
                  <Sparkles className="h-4 w-4 opacity-80" />
              Session trace
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--studio-muted2)]">
                <span className="rounded-full border border-border bg-background px-2.5 py-1 font-medium">
                  {chainEvents.length} events
                </span>
                <span>{selectedThreadOnly ? "Focused chain" : "Full session chain"}</span>
              </div>
        </div>

        <div className="p-5">
          <div className="mb-5 grid gap-4 rounded-2xl border border-border bg-background p-5 shadow-[0_10px_24px_hsl(220_20%_20%/0.03)] lg:grid-cols-[auto_auto_1fr] lg:items-start">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                Scope
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
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
                    "rounded-full border px-3.5 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
                    selectedThreadOnly
                      ? "border-primary/30 bg-primary/10 text-[color:var(--studio-ink)]"
                      : "border-border bg-background text-[color:var(--studio-muted2)] hover:border-[var(--studio-border-strong)] hover:text-foreground",
                  ].join(" ")}
                >
                  {selectedThreadOnly ? "Focused chain" : "All chains"}
                </button>
                <button
                  type="button"
                  onClick={() => setRuntimeTasksOnly((value) => !value)}
                  aria-pressed={runtimeTasksOnly}
                  className={[
                    "rounded-full border px-3.5 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
                    runtimeTasksOnly
                      ? "border-primary/30 bg-primary/10 text-[color:var(--studio-ink)]"
                      : "border-border bg-background text-[color:var(--studio-muted2)] hover:border-[var(--studio-border-strong)] hover:text-foreground",
                  ].join(" ")}
                >
                  {runtimeTasksOnly ? "Auto-created tasks" : "All tasks"}
                </button>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                Window
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(["15m", "60m", "all"] as TimelineWindow[]).map((window) => (
                  <button
                    key={window}
                    type="button"
                    onClick={() => setTimelineWindow(window)}
                    aria-pressed={timelineWindow === window}
                    className={[
                      "rounded-full border px-3.5 py-2 text-xs font-semibold uppercase transition focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
                      timelineWindow === window
                        ? "border-primary/30 bg-primary/10 text-[color:var(--studio-ink)]"
                        : "border-border bg-background text-[color:var(--studio-muted2)] hover:border-[var(--studio-border-strong)] hover:text-foreground",
                    ].join(" ")}
                  >
                    {window}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                Show
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["inject", "action", "decision", "consequence", "task"] as TimelineKind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => toggleTimelineKind(kind)}
                    aria-pressed={timelineFilter[kind]}
                    className={[
                      "rounded-full border px-3.5 py-2 text-xs font-semibold capitalize transition focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
                      timelineFilter[kind]
                        ? "border-primary/30 bg-primary/10 text-[color:var(--studio-ink)]"
                        : "border-border bg-background text-[color:var(--studio-muted2)] hover:border-[var(--studio-border-strong)] hover:text-foreground",
                    ].join(" ")}
                  >
                    {kind}
                  </button>
                ))}
                {selectedTimelineEventId ? (
                  <button
                    type="button"
                    onClick={() => setSelectedTimelineEventId(null)}
                    className="rounded-full border border-border bg-background px-3.5 py-2 text-xs font-semibold text-[color:var(--studio-muted2)] transition hover:border-[var(--studio-border-strong)] hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]"
                  >
                    Clear path
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {selectedTimelinePathEvents.length > 0 ? (
            <div className="mb-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] px-5 py-4 shadow-[0_10px_24px_hsl(160_84%_39%/0.04)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-500/20 bg-[color:var(--studio-surface2)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-800 dark:text-emerald-300">
                  Selected path
                </span>
                <span className="text-sm font-medium text-[color:var(--studio-ink)]">
                  {selectedTimelinePathEvents.length} linked events across the same update chain
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
            <div className="rounded-2xl border border-dashed border-border bg-background px-5 py-6 text-sm text-[color:var(--studio-muted)]">
              No linked events to show yet.
            </div>
          ) : (
            <div className="space-y-5">
              {groupedChainEvents.map((group) => (
                <div key={group.label} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
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
                  <div
                    data-timeline-group={group.label}
                    className="relative overflow-x-auto rounded-2xl border border-border bg-background px-4 pb-5 pt-5 snap-x snap-mandatory"
                  >
                    <div className="pointer-events-none absolute left-4 right-4 top-[56px] h-px bg-border" />
                    <div className="flex min-w-max items-start gap-7 pr-4">
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
                        const shouldConnectNext =
                          event.sessionInjectId != null &&
                          nextEvent?.sessionInjectId != null &&
                          event.sessionInjectId === nextEvent.sessionInjectId;
                        const isSelectedPathConnector =
                          shouldConnectNext &&
                          selectedTimelineEventId != null &&
                          selectedTimelinePathIds.has(event.id) &&
                          selectedTimelinePathIds.has(nextEvent.id);
                        return (
                          <div
                            key={event.id}
                            className={[
                              "relative w-[280px] min-w-[280px] snap-start space-y-4 transition-opacity",
                              isMutedByHover ? "opacity-45" : isMutedBySelection ? "opacity-55" : "opacity-100",
                            ].join(" ")}
                          >
                            {shouldConnectNext ? (
                              <div
                                aria-hidden="true"
                                className={[
                                  "pointer-events-none absolute left-full top-[126px] z-30 flex w-7 items-center",
                                  isSelectedPathConnector || isHoveredThreadEvent || isActiveThreadEvent
                                    ? "opacity-100"
                                    : "opacity-55",
                                ].join(" ")}
                              >
                                <span
                                  className={[
                                    "h-px flex-1 rounded-full",
                                    isSelectedPathConnector
                                      ? "bg-emerald-500/70"
                                      : isHoveredThreadEvent || isActiveThreadEvent
                                      ? "bg-primary/60"
                                      : "bg-border",
                                  ].join(" ")}
                                />
                                <span
                                  className={[
                                    "-ml-1 h-2.5 w-2.5 rotate-45 border-r border-t",
                                    isSelectedPathConnector
                                      ? "border-emerald-500/70"
                                      : isHoveredThreadEvent || isActiveThreadEvent
                                      ? "border-primary/60"
                                      : "border-border",
                                  ].join(" ")}
                                />
                              </div>
                            ) : null}
                            <div className="relative z-20 inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1 shadow-[0_8px_18px_hsl(220_20%_20%/0.035)]">
                              <div
                                className={[
                                  "h-3.5 w-3.5 rounded-full border-2 bg-background",
                                  isSelectedPathEvent
                                    ? "border-emerald-500"
                                    : isActiveThreadEvent || isHoveredThreadEvent
                                    ? "border-primary"
                                    : "border-[var(--studio-border-strong)]",
                                ].join(" ")}
                              />
                              <div className="truncate text-xs font-semibold text-[color:var(--studio-muted2)]">
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
                                "relative min-h-[172px] w-full rounded-2xl border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
                                isSelectedPathEvent
                                  ? "border-emerald-500/35 bg-emerald-500/[0.055] shadow-[0_12px_28px_hsl(160_84%_39%/0.07)]"
                                  : isActiveThreadEvent
                                  ? "border-primary/35 bg-primary/[0.08] shadow-[0_12px_28px_hsl(220_90%_56%/0.07)]"
                                  : isHoveredThreadEvent
                                  ? "border-primary/25 bg-primary/[0.03] shadow-[0_10px_30px_hsl(220_70%_55%/0.08)]"
                                  : "border-border bg-background shadow-[0_8px_20px_hsl(220_20%_20%/0.025)] hover:border-[var(--studio-border-strong)]",
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
                              </div>
                              <div className="mt-3 font-medium leading-snug">{event.title}</div>
                              <div className="mt-1.5 line-clamp-2 text-sm leading-6 text-[color:var(--studio-muted)]">
                                {event.detail}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {event.meta.slice(0, 2).map((meta) => (
                                  <span
                                    key={`${event.id}:${meta}`}
                                    className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2 py-0.5 text-[11px] text-[color:var(--studio-muted2)]"
                                  >
                                    {meta}
                                  </span>
                                ))}
                                {event.meta.length > 2 ? (
                                  <span className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-2 py-0.5 text-[11px] text-[color:var(--studio-muted2)]">
                                    +{event.meta.length - 2}
                                  </span>
                                ) : null}
                              </div>
                              {event.relations.length > 0 ? (
                                <div className="mt-3 border-t border-[var(--studio-border)] pt-3 text-[11px] text-[color:var(--studio-muted2)]">
                                  {event.relations[0]?.label}
                                  {event.relations.length > 1 ? ` +${event.relations.length - 1} more links` : null}
                                </div>
                              ) : null}
                              {event.sessionInjectId ? (
                                <div className="mt-4 text-[11px] font-medium text-[color:var(--studio-muted2)]">
                                  View linked update chain
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

      {advancedInsightsOpen ? (
      <div className={isMobile ? "grid grid-cols-1 gap-4" : "grid grid-cols-12 gap-4"}>
        <div className={isMobile ? "" : "col-span-5"}>
          <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
                <CheckSquare className="h-4 w-4 opacity-80" />
                Follow-up tasks
              </div>
              <div className="text-xs text-[color:var(--studio-muted2)]">
                {`${visibleTasks.length} shown`}
              </div>
            </div>

            <div className="p-5">
              <div className="space-y-3">
                {visibleTasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background px-5 py-6 text-sm text-[color:var(--studio-muted)]">
                    No follow-up tasks yet.
                  </div>
                ) : (
                  visibleTasks.slice(0, 8).map((task) => (
                    <div
                      key={task.id}
                      className={[
                        "rounded-2xl border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]",
                        task.due_at && new Date(task.due_at).getTime() <= Date.now() && task.status !== "done" && task.status !== "cancelled"
                          ? "border-red-500/25"
                          : "border-border",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground">{task.title}</div>
                          {task.description ? (
                            <div className="mt-1 text-sm leading-6 text-[color:var(--studio-muted)]">
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
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {task.status !== "in_progress" && task.status !== "done" && task.status !== "cancelled" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={taskBusyId === task.id}
                              onClick={() => handleTaskStatus(task.id, "in_progress")}
                            >
                              Start
                            </Button>
                          ) : null}
                          {task.status !== "blocked" && task.status !== "done" && task.status !== "cancelled" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={taskBusyId === task.id}
                              onClick={() => handleTaskStatus(task.id, "blocked")}
                            >
                              Block
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={taskBusyId === task.id || task.status === "done"}
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
          <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
                <Sparkles className="h-4 w-4 opacity-80" />
                Developments
              </div>
              <div className="text-xs text-[color:var(--studio-muted2)]">
                {`${visibleConsequences.length} shown`}
              </div>
            </div>

            <div className="p-5">
              <div className="space-y-3">
                {visibleConsequences.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background px-5 py-6 text-sm text-[color:var(--studio-muted)]">
                    No developments yet.
                  </div>
                ) : (
                  visibleConsequences.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground">{item.title}</div>
                          {item.description ? (
                            <div className="mt-1 text-sm leading-6 text-[color:var(--studio-muted)]">
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
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={isMobile ? "" : "col-span-3"}>
          <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
                <ListChecks className="h-4 w-4 opacity-80" />
                Key decisions
              </div>
              <div className="text-xs text-[color:var(--studio-muted2)]">
                {actionsLoading
                  ? "Loading…"
                  : actionsError
                  ? actionsError
                  : `${notableActions.length} shown`}
              </div>
            </div>

            <div className="p-5">
              <div className="space-y-3">
                {actionsLoading ? (
                  <div className="text-sm text-[color:var(--studio-muted2)]">
                    Loading…
                  </div>
                ) : notableActions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-background px-5 py-6 text-sm text-[color:var(--studio-muted)]">
                    No notable decisions yet.
                  </div>
                ) : (
                  notableActions.slice(0, 12).map((a) => {
                    const linkedDecision = decisionsByActionId.get(a.id);
                    const linkedTasks = tasksBySourceActionId.get(a.id) ?? [];
                    return (
                      <div
                        key={a.id}
                        className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground">
                            {responseDecisionLabel(a, linkedDecision?.decision_type, linkedTasks.length)}
                          </div>
                          <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
                            {responseTargetLabel(a)}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[color:var(--studio-muted2)]">
                          <span>{fmt(a.created_at)}</span>
                          {linkedTasks.length > 0 ? (
                            <span className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface)] px-2 py-0.5">
                              {linkedTasks.length === 1 ? "1 follow-up" : `${linkedTasks.length} follow-ups`}
                            </span>
                          ) : null}
                          {linkedDecision?.decision_type === "confirm" || linkedDecision?.decision_type === "deny" ? (
                            <span className="rounded-full border border-[var(--studio-border)] bg-[color:var(--studio-surface)] px-2 py-0.5">
                              {linkedDecision.decision_type === "confirm" ? "Public response" : "Claim dismissed"}
                            </span>
                          ) : null}
                        </div>
                        {a.comment ? (
                          <div className="mt-3 rounded-2xl border border-border bg-background px-3 py-2.5 text-sm leading-6 text-[color:var(--studio-muted)]">
                            {a.comment}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : null}
    </div>
  );
}
