// app/(app)/sessions/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import type { Scenario } from "@/lib/scenarios";
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
} from "@/lib/sessions";

import SituationCard from "@/app/components/SituationCard";
import MessageDetail from "@/app/components/MessageDetail";
import FacilitatorToolsPanel from "@/app/components/FacilitatorToolsPanel";
import Inbox from "@/app/components/Inbox";
import PulseFeed from "@/app/components/PulseFeed";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  X,
  ChevronDown,
  SlidersHorizontal,
  LayoutDashboard,
  MessagesSquare,
  Radio,
  FileText,
  ListChecks,
  Wrench,
} from "lucide-react";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

type SelectedSource = "inbox" | "pulse";
type StreamTab = "inbox" | "pulse";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    m.addEventListener?.("change", onChange);
    return () => m.removeEventListener?.("change", onChange);
  }, [query]);
  return matches;
}

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[
        "h-10 w-full rounded-[var(--radius)] px-3 text-sm",
        "border border-[var(--studio-border)]",
        "bg-[var(--studio-surface2)] text-foreground",
        "shadow-[0_1px_2px_hsl(220_20%_20%/0.06)]",
        "hover:border-[var(--studio-border-strong)]",
        "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
        "transition-[box-shadow,border-color,background-color] duration-150",
      ].join(" ")}
    >
      {children}
    </select>
  );
}

function Chip({
  label,
  onClear,
  title,
}: {
  label: string;
  onClear: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      title={title}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2.5 py-1 text-xs font-medium hover:bg-secondary/60 transition"
    >
      <span className="truncate max-w-[220px]">{label}</span>
      <X className="h-3.5 w-3.5 opacity-70" />
    </button>
  );
}

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] leading-none px-2 h-5">
      {n > 99 ? "99+" : n}
    </span>
  );
}

function RuntimeMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-4 py-3 shadow-[0_10px_30px_hsl(220_20%_20%/0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
            {label}
          </div>
          <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--studio-border)] bg-white/80 text-[color:var(--studio-ink)]">
          {icon}
        </div>
      </div>
    </div>
  );
}

function lsKey(sessionId: string, kind: "inbox" | "pulse") {
  return `decisionary.seen.${kind}.${sessionId}`;
}

type SessionMetaRow = {
  scenario_id?: string | null;
  scenario?: string | null;
  scenarioId?: string | null;
  started_at?: string | null;
  created_by?: string | null;
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

export default function SessionParticipantPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ?? "";
  const validSessionId = useMemo(() => isUuid(sessionId), [sessionId]);

  const isMobile = useMediaQuery("(max-width: 1100px)");

  const [error, setError] = useState<string | null>(null);

  // meta
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [sessionOwnerId, setSessionOwnerId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
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

  // Streams tabs + filters popover
  const [streamTab, setStreamTab] = useState<StreamTab>("inbox");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersWrapRef = useRef<HTMLDivElement | null>(null);

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

  const [comment, setComment] = useState("");

  // Facilitator tools popover
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsWrapRef = useRef<HTMLDivElement | null>(null);

  // Unseen badges
  const [unseenInbox, setUnseenInbox] = useState(0);
  const [unseenPulse, setUnseenPulse] = useState(0);

  const sessionTitle = scenario?.title ? scenario.title : "Session";

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

  async function refreshScenarioAndOwner() {
    if (!validSessionId) return;
    try {
      const { data: sess, error: sessErr } = await supabase
        .from("sessions")
        .select("scenario_id, started_at, created_by")
        .eq("id", sessionId)
        .maybeSingle();

      if (sessErr) throw sessErr;

      const sessRow = (sess ?? null) as SessionMetaRow | null;
      const scenarioId =
        sessRow?.scenario_id ?? sessRow?.scenario ?? sessRow?.scenarioId ?? null;
      const ownerId = sessRow?.created_by ?? null;
      const sa = sessRow?.started_at ?? null;
      setStartedAt(typeof sa === "string" && sa ? sa : null);
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

  // Close popovers (filters/tools) on Escape/outside click
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setToolsOpen(false);
        setFiltersOpen(false);
      }
    }
    function onDocMouseDown(e: MouseEvent) {
      if (toolsOpen) {
        const el = toolsWrapRef.current;
        if (el && e.target instanceof Node && !el.contains(e.target))
          setToolsOpen(false);
      }
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
  }, [toolsOpen, filtersOpen]);

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

    // Unseen subscriptions
    const unsubInbox = subscribeInbox(sessionId, () => refreshUnseen(), 300);
    const unsubPulse = subscribePulse(sessionId, () => refreshUnseen(), 300);

    return () => {
      unsubA?.();
      unsubS?.();
      unsubM?.();
      unsubInbox?.();
      unsubPulse?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, validSessionId]);

  const selectedActions = useMemo(() => {
    if (!selectedItem) return [];
    return actions.filter((a) => a.session_inject_id === selectedItem.id);
  }, [actions, selectedItem]);

  async function doAction(actionType: "ignore" | "escalate" | "act") {
    if (!selectedItem) return;

    try {
      const saved = await addSessionAction({
        sessionId,
        sessionInjectId: selectedItem.id,
        source: selectedSource,
        actionType,
        comment: comment.trim() ? comment.trim() : null,
      });

      setActions((prev) => [saved, ...prev]);

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
      }

      setComment("");
    } catch (e: unknown) {
      setActionsError(getErrorMessage(e, "Failed to save action"));
    }
  }

  async function doPulseDecision(decision: "confirm" | "deny") {
    if (!selectedItem) return;

    try {
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
      setComment("");
    } catch (e: unknown) {
      setActionsError(getErrorMessage(e, "Failed to process Pulse decision"));
    }
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
        <h1 className="text-xl font-semibold">Invalid session id</h1>
        <p className="text-sm text-[color:var(--studio-muted2)]">
          This URL parameter must be a UUID.
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
      {/* Header */}
      <div className="relative z-20 surface shadow-soft rounded-[var(--studio-radius)] overflow-visible border border-[var(--studio-border)]">
        <div className="relative overflow-visible rounded-[var(--studio-radius)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 rounded-t-[var(--studio-radius)] bg-[radial-gradient(circle_at_top_left,hsl(240_75%_92%/0.7),transparent_58%)]" />
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-56 rounded-tr-[var(--studio-radius)] bg-[radial-gradient(circle_at_top_right,hsl(205_90%_96%/0.95),transparent_68%)]" />

          <div className="relative px-5 py-5 sm:px-6 sm:py-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_360px] xl:items-start">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--studio-border)] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--studio-muted2)]">
                  <Radio className="h-3.5 w-3.5" />
                  Live session control
                </div>

                <div className="mt-4 text-xs text-[color:var(--studio-muted2)]">
                  Session {sessionId.slice(0, 8)} • Started {fmt(startedAt)}
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--studio-ink)] sm:text-[2rem]">
                  {sessionTitle}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--studio-muted)]">
                  Run the live exercise, track incoming signals, record decisions,
                  and keep the common operating picture current from one place.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <Button
                    variant={copOpen ? "secondary" : "outline"}
                    onClick={() => setCopOpen((v) => !v)}
                    className="gap-2"
                    title="Toggle COP"
                  >
                    <LayoutDashboard className="h-4 w-4 opacity-80" />
                    {copOpen ? "Hide COP" : "Open COP"}
                    <ChevronDown
                      className={[
                        "h-4 w-4 opacity-70 transition-transform",
                        copOpen ? "rotate-180" : "",
                      ].join(" ")}
                    />
                  </Button>

                  <div className="relative overflow-visible" ref={toolsWrapRef}>
                    {roleLoading ? (
                      <div className="px-2 text-xs text-[color:var(--studio-muted2)]">
                        Loading role…
                      </div>
                    ) : isFacilitator ? (
                      <>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setToolsOpen((v) => !v);
                          }}
                          className="gap-2"
                        >
                          <Wrench className="h-4 w-4" />
                          Facilitator tools
                        </Button>

                        {toolsOpen ? (
                          <div className="absolute left-0 top-full z-50 mt-3 w-[420px] max-w-[92vw] overflow-hidden rounded-[16px] border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-soft">
                            <div className="flex items-center justify-between border-b border-[var(--studio-border)] px-4 py-3">
                              <div>
                                <div className="text-sm font-semibold">
                                  Facilitator panel
                                </div>
                                <div className="text-xs text-[color:var(--studio-muted2)]">
                                  Release injects and steer the live run.
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                onClick={() => setToolsOpen(false)}
                              >
                                Close
                              </Button>
                            </div>

                            <div className="max-h-[70vh] overflow-auto p-4">
                              <FacilitatorToolsPanel
                                sessionId={sessionId}
                                scenarioId={scenario?.id ?? null}
                                compact
                                onSessionMetaChange={(meta) =>
                                  applySessionMeta(meta as SessionMetaPayloadRow | null)
                                }
                              />
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <RuntimeMetric
                  label="Exercise clock"
                  value={exerciseClock}
                  icon={<Radio className="h-4 w-4" />}
                />
                <RuntimeMetric
                  label="Selected stream"
                  value={streamTab === "inbox" ? "Inbox" : "Pulse"}
                  icon={
                    streamTab === "inbox" ? (
                      <MessagesSquare className="h-4 w-4" />
                    ) : (
                      <Radio className="h-4 w-4" />
                    )
                  }
                />
                <RuntimeMetric
                  label="Action log"
                  value={String(actions.length)}
                  icon={<ListChecks className="h-4 w-4" />}
                />
              </div>
            </div>
          </div>
        </div>

        {/* COP collapsible */}
        {copOpen ? (
          <div className="border-t border-[var(--studio-border)]">
            <div className="px-5 py-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <LayoutDashboard className="h-4 w-4 opacity-80" />
                    Common Operating Picture
                  </div>
                  <div className="text-xs text-[color:var(--studio-muted2)] mt-1">
                    Update key figures and keep the situation current.
                  </div>
                </div>
              </div>

              <SituationCard
                scenario={scenario}
                situation={situation}
                onUpdateCasualties={async (p) => {
                  if (!validSessionId) return;
                  const s = await updateCasualties({
                    sessionId,
                    injured: p.injured,
                    fatalities: p.fatalities,
                    uninjured: p.uninjured,
                    unknown: p.unknown,
                  });
                  setSituation(s);
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Streams + Detail */}
      <div
        className={
          isMobile
            ? "relative z-0 grid grid-cols-1 gap-4"
            : "relative z-0 grid grid-cols-12 gap-4"
        }
      >
        {/* STREAMS */}
        <div className={isMobile ? "" : "col-span-4"}>
          <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-visible border border-[var(--studio-border)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--studio-border)] px-4 py-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
                  <MessagesSquare className="h-4 w-4 opacity-80" />
                  Streams
                </div>
                <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
                  Monitor incoming messages and switch between operational feeds.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={[
                    "h-9 px-3 rounded-[var(--radius)] border text-sm font-medium transition inline-flex items-center gap-2",
                    streamTab === "inbox"
                      ? "bg-primary/10 border-primary/25"
                      : "bg-[var(--studio-surface2)] border-[var(--studio-border)] hover:bg-secondary/60",
                  ].join(" ")}
                  onClick={() => {
                    setStreamTab("inbox");
                    setSelectedSource("inbox");
                    markSeen("inbox");
                    refreshUnseen();
                  }}
                >
                  <MessagesSquare className="h-4 w-4 opacity-75" />
                  Inbox <Badge n={unseenInbox} />
                </button>

                <button
                  type="button"
                  className={[
                    "h-9 px-3 rounded-[var(--radius)] border text-sm font-medium transition inline-flex items-center gap-2",
                    streamTab === "pulse"
                      ? "bg-primary/10 border-primary/25"
                      : "bg-[var(--studio-surface2)] border-[var(--studio-border)] hover:bg-secondary/60",
                  ].join(" ")}
                  onClick={() => {
                    setStreamTab("pulse");
                    setSelectedSource("pulse");
                    markSeen("pulse");
                    refreshUnseen();
                  }}
                >
                  <Radio className="h-4 w-4 opacity-75" />
                  Pulse <Badge n={unseenPulse} />
                </button>

                <div className="relative overflow-visible" ref={filtersWrapRef}>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setFiltersOpen((v) => !v)}
                    title="Filters"
                    className={
                      streamTab === "inbox"
                        ? inboxFiltersActive
                          ? "border-primary/25"
                          : ""
                        : pulseFiltersActive
                        ? "border-primary/25"
                        : ""
                    }
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>

                  {filtersOpen ? (
                    <div className="absolute right-0 mt-2 w-[360px] max-w-[92vw] popover-solid rounded-[14px] shadow-soft overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-[var(--studio-border)] flex items-center justify-between">
                        <div className="text-sm font-semibold">
                          {streamTab === "inbox"
                            ? "Inbox filters"
                            : "Pulse filters"}
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => setFiltersOpen(false)}
                        >
                          Close
                        </Button>
                      </div>

                      <div className="p-4 space-y-3">
                        {streamTab === "inbox" ? (
                          <>
                            <Input
                              value={inboxSearch}
                              onChange={(e) => setInboxSearch(e.target.value)}
                              placeholder="Search inbox…"
                            />

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <Select
                                value={inboxSeverity ?? ""}
                                onChange={(v) =>
                                  setInboxSeverity(v ? v : null)
                                }
                              >
                                <option value="">Severity: All</option>
                                <option value="low">LOW</option>
                                <option value="medium">MEDIUM</option>
                                <option value="high">HIGH</option>
                                <option value="critical">CRITICAL</option>
                              </Select>

                              <Select
                                value={inboxChannel ?? ""}
                                onChange={(v) => setInboxChannel(v ? v : null)}
                              >
                                <option value="">Channel: All</option>
                                <option value="ops">OPS</option>
                                <option value="media">MEDIA</option>
                                <option value="social">SOCIAL</option>
                              </Select>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={clearInboxFilters}
                              >
                                Clear
                              </Button>
                              <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                  markSeen("inbox");
                                  refreshUnseen();
                                }}
                                title="Marks all current Inbox as seen"
                              >
                                Mark seen
                              </Button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {inboxSearch.trim() ? (
                                <Chip
                                  label={`Search: ${inboxSearch.trim()}`}
                                  onClear={() => setInboxSearch("")}
                                />
                              ) : null}
                              {inboxSeverity ? (
                                <Chip
                                  label={`Severity: ${inboxSeverity}`}
                                  onClear={() => setInboxSeverity(null)}
                                />
                              ) : null}
                              {inboxChannel ? (
                                <Chip
                                  label={`Channel: ${inboxChannel}`}
                                  onClear={() => setInboxChannel(null)}
                                />
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <>
                            <Input
                              value={pulseSearch}
                              onChange={(e) => setPulseSearch(e.target.value)}
                              placeholder="Search pulse…"
                            />

                            <Select
                              value={pulseSeverity ?? ""}
                              onChange={(v) =>
                                setPulseSeverity(v ? v : null)
                              }
                            >
                              <option value="">Severity: All</option>
                              <option value="low">LOW</option>
                              <option value="medium">MEDIUM</option>
                              <option value="high">HIGH</option>
                              <option value="critical">CRITICAL</option>
                            </Select>

                            <div className="flex gap-2">
                              <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={clearPulseFilters}
                              >
                                Clear
                              </Button>
                              <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                  markSeen("pulse");
                                  refreshUnseen();
                                }}
                                title="Marks all current Pulse as seen"
                              >
                                Mark seen
                              </Button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {pulseSearch.trim() ? (
                                <Chip
                                  label={`Search: ${pulseSearch.trim()}`}
                                  onClear={() => setPulseSearch("")}
                                />
                              ) : null}
                              {pulseSeverity ? (
                                <Chip
                                  label={`Severity: ${pulseSeverity}`}
                                  onClear={() => setPulseSeverity(null)}
                                />
                              ) : null}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="p-3">
              {streamTab === "inbox" ? (
                <Inbox
                  sessionId={sessionId}
                  selectedId={selectedItem?.id ?? null}
                  onSelect={(item) => {
                    setSelectedItem(item);
                    setSelectedSource("inbox");
                  }}
                  channel={inboxChannel}
                  severity={inboxSeverity}
                  search={inboxSearch}
                />
              ) : (
                <PulseFeed
                  sessionId={sessionId}
                  selectedId={selectedItem?.id ?? null}
                  onSelect={(item) => {
                    setSelectedItem(item);
                    setSelectedSource("pulse");
                  }}
                  severity={pulseSeverity}
                  search={pulseSearch}
                />
              )}
            </div>
          </div>
        </div>

        {/* DETAIL */}
        <div className={isMobile ? "" : "col-span-8"}>
          <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
            <div className="flex items-center justify-between border-b border-[var(--studio-border)] px-4 py-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
                  <FileText className="h-4 w-4 opacity-80" />
                  Message detail
                </div>
                <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
                  Review the selected item and record the operational response.
                </div>
              </div>
              <div className="text-xs text-[color:var(--studio-muted2)]">
                {selectedItem
                  ? `Actions: ${actionsLoading ? "…" : selectedActions.length}`
                  : "No selection"}
              </div>
            </div>

            <div className="p-5">
              <MessageDetail
                item={selectedItem}
                activeTab={selectedSource}
                comment={comment}
                setComment={setComment}
                onIgnore={() => doAction("ignore")}
                onEscalate={() => doAction("escalate")}
                onAct={() => doAction("act")}
                onConfirm={() => doPulseDecision("confirm")}
                onDeny={() => doPulseDecision("deny")}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ACTION LOG – bottom */}
      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden border border-[var(--studio-border)]">
        <div className="flex items-center justify-between border-b border-[var(--studio-border)] px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--studio-ink)]">
              <ListChecks className="h-4 w-4 opacity-80" />
              Action log
            </div>
            <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
              Capture facilitator decisions and visible operator responses.
            </div>
          </div>
          <div className="text-xs text-[color:var(--studio-muted2)]">
            {actionsLoading
              ? "Loading…"
              : actionsError
              ? actionsError
              : `${actions.length} total`}
          </div>
        </div>

        <div className="p-5">
          <div className="space-y-2.5">
            {actionsLoading ? (
              <div className="text-sm text-[color:var(--studio-muted2)]">
                Loading…
              </div>
            ) : actions.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-4 py-5 text-sm text-[color:var(--studio-muted2)]">
                No actions yet.
              </div>
            ) : (
              actions.slice(0, 30).map((a) => (
                <div
                  key={a.id}
                  className="rounded-[14px] border border-[var(--studio-border)] bg-[color:var(--studio-surface2)] px-3.5 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-[color:var(--studio-muted2)]">
                      {fmt(a.created_at)}
                    </div>
                    <div className="text-xs font-semibold">
                      {a.action_type.toUpperCase()}
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
  );
}
