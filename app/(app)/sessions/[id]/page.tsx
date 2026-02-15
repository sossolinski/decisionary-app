// app/(app)/sessions/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import type { Scenario } from "@/lib/scenarios";

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
} from "@/lib/sessions";

import SituationCard from "@/app/components/SituationCard";
import MessageDetail from "@/app/components/MessageDetail";
import FacilitatorToolsPanel from "@/app/components/FacilitatorToolsPanel";
import Inbox from "@/app/components/Inbox";
import PulseFeed from "@/app/components/PulseFeed";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { X } from "lucide-react";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

type SelectedSource = "inbox" | "pulse";

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
        "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
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
      <span className="truncate max-w-[240px]">{label}</span>
      <X className="h-3.5 w-3.5 opacity-70" />
    </button>
  );
}

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
  const [situation, setSituation] = useState<SessionSituation | null>(null);

  // Selection
  const [selectedItem, setSelectedItem] = useState<SessionInject | null>(null);
  const [selectedSource, setSelectedSource] = useState<SelectedSource>("inbox");

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

  const sessionTitle = scenario?.title ? scenario.title : "Session";

  async function refreshSituation() {
    if (!validSessionId) return;
    try {
      const s = await getSessionSituation(sessionId);
      setSituation(s);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load situation");
    }
  }

  async function refreshActions() {
    if (!validSessionId) return;
    try {
      setActionsLoading(true);
      setActionsError(null);
      const rows = await getSessionActions(sessionId, 50);
      setActions(rows);
    } catch (e: any) {
      setActionsError(e?.message ?? "Failed to load actions");
    } finally {
      setActionsLoading(false);
    }
  }

  async function refreshScenarioAndOwner() {
    if (!validSessionId) return;
    try {
      // ✅ FIX: owner_id doesn't exist; use created_by as owner fallback
      const { data: sess, error: sessErr } = await supabase
        .from("sessions")
        .select("scenario_id, started_at, created_by")
        .eq("id", sessionId)
        .maybeSingle();

      if (sessErr) throw sessErr;

      const scenarioId =
        (sess as any)?.scenario_id ??
        (sess as any)?.scenario ??
        (sess as any)?.scenarioId ??
        null;

      const ownerId = (sess as any)?.created_by ?? null;

      const sa = (sess as any)?.started_at ?? null;
      setStartedAt(typeof sa === "string" && sa ? sa : null);
      setSessionOwnerId(typeof ownerId === "string" && ownerId ? ownerId : null);

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

      setScenario((sc as any) ?? null);
    } catch (e: any) {
      setScenario(null);
      setError(
        (prev) =>
          prev ??
          (e?.message ? `Scenario/meta load: ${e.message}` : "Scenario/meta load failed")
      );
    }
  }

  // Initial load
  useEffect(() => {
    if (!validSessionId) return;
    setError(null);
    refreshScenarioAndOwner();
    refreshSituation();
    refreshActions();
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

  // Close tools popover on Escape/outside click
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setToolsOpen(false);
    }
    function onDocMouseDown(e: MouseEvent) {
      if (!toolsOpen) return;
      const el = toolsWrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setToolsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDocMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDocMouseDown);
    };
  }, [toolsOpen]);

  // Role gating (session_role_assignments OR created_by fallback)
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

        if (sessionOwnerId && sessionOwnerId === authUserId) {
          if (alive) setIsFacilitator(true);
          return;
        }

        const { data, error } = await supabase
          .from("session_role_assignments")
          .select("*")
          .eq("session_id", sessionId);

        if (error) throw error;

        const rows = (data ?? []) as any[];
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

  // ✅ FIX: Realtime via payloads (NO refetch loop)
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
      const sa = (row as any)?.started_at ?? null;
      setStartedAt((prev) => {
        const next = typeof sa === "string" && sa ? sa : null;
        return prev === next ? prev : next;
      });
    });

    return () => {
      unsubA?.();
      unsubS?.();
      unsubM?.();
    };
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
        const title = `Update: action taken on "${selectedItem.injects?.title ?? "message"}"`;
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
    } catch (e: any) {
      alert(e?.message ?? "Failed to save action");
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
    } catch (e: any) {
      alert(e?.message ?? "Failed to process Pulse decision");
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

  if (!sessionId) {
    return <div className="text-sm text-[color:var(--studio-muted2)]">Loading…</div>;
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
      <div className="rounded-[var(--studio-radius)] border border-[var(--studio-border)] bg-[var(--studio-highlight)] shadow-soft p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs text-[color:var(--studio-muted2)]">
              Session • {sessionId.slice(0, 8)} • {fmt(startedAt)}
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight truncate">
              {sessionTitle}
            </h1>
            <div className="mt-2 text-sm text-[color:var(--studio-muted2)]">
              Exercise clock:{" "}
              <span className="text-foreground font-medium">{exerciseClock}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={refreshSituation}>
              Refresh COP
            </Button>
            <Button variant="outline" onClick={refreshActions}>
              Refresh actions
            </Button>

            <div className="relative" ref={toolsWrapRef}>
              {roleLoading ? (
                <div className="text-xs text-[color:var(--studio-muted2)] px-2">
                  Loading role…
                </div>
              ) : isFacilitator ? (
                <>
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setToolsOpen((v) => !v);
                    }}
                  >
                    Facilitator tools
                  </Button>

                  {toolsOpen ? (
                    <div className="absolute right-0 mt-2 w-[420px] max-w-[92vw] popover-solid rounded-[14px] shadow-soft overflow-hidden">
                      <div className="px-4 py-3 border-b border-[var(--studio-border)] flex items-center justify-between">
                        <div className="text-sm font-semibold">Facilitator panel</div>
                        <Button variant="outline" onClick={() => setToolsOpen(false)}>
                          Close
                        </Button>
                      </div>

                      <div className="p-4">
                        <FacilitatorToolsPanel sessionId={sessionId} />
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* COP */}
      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--studio-border)]">
          <div className="text-sm font-semibold">Common Operating Picture</div>
          <div className="text-xs text-[color:var(--studio-muted2)] mt-1">
            Update key figures and keep the situation current.
          </div>
        </div>
        <div className="p-4">
          <SituationCard
            situation={situation}
            onSave={async (p) => {
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

      {/* Main 3-column layout (Inbox | Pulse | Detail) */}
      <div className={isMobile ? "grid grid-cols-1 gap-4" : "grid grid-cols-12 gap-4"}>
        {/* INBOX */}
        <div className={isMobile ? "" : "col-span-4"}>
          <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--studio-border)]">
              <div className="text-sm font-semibold">Inbox</div>
              <div className="text-xs text-[color:var(--studio-muted2)] mt-1">
                Operational / media / social injects.
              </div>
            </div>

            {/* Inbox filters */}
            <div className="p-3 border-b border-[var(--studio-border)] space-y-2">
              <Input
                value={inboxSearch}
                onChange={(e) => setInboxSearch(e.target.value)}
                placeholder="Search inbox…"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Select value={inboxSeverity ?? ""} onChange={(v) => setInboxSeverity(v ? v : null)}>
                  <option value="">Severity: All</option>
                  <option value="low">LOW</option>
                  <option value="medium">MEDIUM</option>
                  <option value="high">HIGH</option>
                  <option value="critical">CRITICAL</option>
                </Select>

                <Select value={inboxChannel ?? ""} onChange={(v) => setInboxChannel(v ? v : null)}>
                  <option value="">Channel: All</option>
                  <option value="ops">OPS</option>
                  <option value="media">MEDIA</option>
                  <option value="social">SOCIAL</option>
                </Select>

                <Button variant="secondary" onClick={clearInboxFilters}>
                  Clear
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {inboxSearch.trim() ? (
                  <Chip label={`Search: ${inboxSearch.trim()}`} onClear={() => setInboxSearch("")} />
                ) : null}
                {inboxSeverity ? (
                  <Chip label={`Severity: ${inboxSeverity}`} onClear={() => setInboxSeverity(null)} />
                ) : null}
                {inboxChannel ? (
                  <Chip label={`Channel: ${inboxChannel}`} onClear={() => setInboxChannel(null)} />
                ) : null}
              </div>
            </div>

            <div className="p-3">
              <Inbox
                sessionId={sessionId}
                onSelect={(item) => {
                  setSelectedItem(item);
                  setSelectedSource("inbox");
                }}
                channel={inboxChannel}
                severity={inboxSeverity}
                search={inboxSearch}
              />
            </div>
          </div>
        </div>

        {/* PULSE */}
        <div className={isMobile ? "" : "col-span-4"}>
          <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--studio-border)]">
              <div className="text-sm font-semibold">Pulse</div>
              <div className="text-xs text-[color:var(--studio-muted2)] mt-1">
                Social noise / external signals.
              </div>
            </div>

            {/* Pulse filters */}
            <div className="p-3 border-b border-[var(--studio-border)] space-y-2">
              <Input
                value={pulseSearch}
                onChange={(e) => setPulseSearch(e.target.value)}
                placeholder="Search pulse…"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select value={pulseSeverity ?? ""} onChange={(v) => setPulseSeverity(v ? v : null)}>
                  <option value="">Severity: All</option>
                  <option value="low">LOW</option>
                  <option value="medium">MEDIUM</option>
                  <option value="high">HIGH</option>
                  <option value="critical">CRITICAL</option>
                </Select>

                <Button variant="secondary" onClick={clearPulseFilters}>
                  Clear
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {pulseSearch.trim() ? (
                  <Chip label={`Search: ${pulseSearch.trim()}`} onClear={() => setPulseSearch("")} />
                ) : null}
                {pulseSeverity ? (
                  <Chip label={`Severity: ${pulseSeverity}`} onClear={() => setPulseSeverity(null)} />
                ) : null}
              </div>
            </div>

            <div className="p-3">
              <PulseFeed
                sessionId={sessionId}
                onSelect={(item) => {
                  setSelectedItem(item);
                  setSelectedSource("pulse");
                }}
                severity={pulseSeverity}
                search={pulseSearch}
              />
            </div>
          </div>
        </div>

        {/* DETAIL */}
        <div className={isMobile ? "" : "col-span-4"}>
          <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--studio-border)] flex items-center justify-between">
              <div className="text-sm font-semibold">Message detail</div>
              <div className="text-xs text-[color:var(--studio-muted2)]">
                {selectedItem ? `Actions: ${actionsLoading ? "…" : selectedActions.length}` : "No selection"}
              </div>
            </div>

            <div className="p-4 space-y-4">
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

              <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Action log</div>
                  <Button variant="outline" onClick={refreshActions}>
                    Refresh
                  </Button>
                </div>

                {actionsError ? (
                  <div className="mt-3 text-sm text-[color:var(--studio-muted2)]">{actionsError}</div>
                ) : null}

                <div className="mt-3 space-y-2">
                  {actionsLoading ? (
                    <div className="text-sm text-[color:var(--studio-muted2)]">Loading…</div>
                  ) : actions.length === 0 ? (
                    <div className="text-sm text-[color:var(--studio-muted2)]">No actions yet.</div>
                  ) : (
                    actions.slice(0, 30).map((a) => (
                      <div
                        key={a.id}
                        className="rounded-[12px] border border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-[color:var(--studio-muted2)]">{fmt(a.created_at)}</div>
                          <div className="text-xs font-semibold">{a.action_type.toUpperCase()}</div>
                        </div>
                        {a.comment ? <div className="mt-1 text-sm">{a.comment}</div> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
