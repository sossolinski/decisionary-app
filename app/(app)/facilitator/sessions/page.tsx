// app/(app)/facilitator/sessions/page.tsx
"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
  listSessions,
  listScenarios,
  createRehearsalSessionFromScenario,
  createLiveSessionFromScenario,
  setSessionStatus,
  restartSession,
  deleteSession,
  type Session,
  type ScenarioListItem,
  type LiveExerciseAccess,
} from "@/lib/sessionsRuntime";
import { getBillingInfraMessage, listMyLiveExerciseAccess } from "@/lib/billing";
import { getErrorMessage } from "@/lib/errors";
import { normalizeSessionStatus } from "@/lib/sessionStatus";
import { validateSessionTitle } from "@/lib/validators";
import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";
import { Button } from "@/app/components/ui/button";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import HintTooltip from "@/app/components/HintTooltip";
import SessionCreatePanel from "@/app/components/facilitator-sessions/SessionCreatePanel";
import SessionLibrary from "@/app/components/facilitator-sessions/SessionLibrary";
import { type StatusFilter } from "@/app/components/facilitator-sessions/sessionUi";
import { ArrowRight } from "lucide-react";

type PendingConfirm = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "default" | "destructive";
  onConfirm: () => Promise<void>;
};

export default function FacilitatorSessionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading: roleLoading, canFacilitate } = useRoleContext();
  const ids = useId();
  const scenarioSelectRef = useRef<HTMLSelectElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [liveAccess, setLiveAccess] = useState<LiveExerciseAccess[]>([]);

  const [scenarioId, setScenarioId] = useState("");
  const [title, setTitle] = useState("New session");
  const [createMode, setCreateMode] = useState<"rehearsal" | "live">("rehearsal");
  const [participantTier, setParticipantTier] = useState("5");

  // UI: quick filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // UI: minimal actions toggle per-row
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const [menuPanelPosition, setMenuPanelPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenMenuId(null);
        return;
      }

      if (isEditableTarget(e.target)) return;

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        scenarioSelectRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const openId = openMenuId;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenuId(null);
    }

    function onPointerDown(e: MouseEvent) {
      const panel = menuPanelRef.current;
      const button = menuButtonRefs.current[openId];
      if (!(e.target instanceof Node)) return;
      if (panel?.contains(e.target) || button?.contains(e.target)) return;
      setOpenMenuId(null);
    }

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [openMenuId]);

  useLayoutEffect(() => {
    if (!openMenuId) return;
    const openId = openMenuId;
    const gap = 10;
    const viewportPadding = 16;

    function placePanel() {
      const button = menuButtonRefs.current[openId];
      const panel = menuPanelRef.current;
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

      setMenuPanelPosition({ top: nextTop, left: nextLeft });
    }

    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
    };
  }, [openMenuId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [sesResult, scsResult, accessResult] = await Promise.allSettled([
        listSessions(),
        listScenarios(),
        listMyLiveExerciseAccess(),
      ]);
      const billingInfraMessage =
        accessResult.status === "rejected" ? getBillingInfraMessage(accessResult.reason) : null;

      if (sesResult.status === "rejected") throw sesResult.reason;
      if (scsResult.status === "rejected") throw scsResult.reason;

      setSessions((sesResult.value ?? []) as Session[]);
      setScenarios((scsResult.value ?? []) as ScenarioListItem[]);
      setLiveAccess(accessResult.status === "fulfilled" ? ((accessResult.value ?? []) as LiveExerciseAccess[]) : []);

      if (billingInfraMessage) {
        setError(billingInfraMessage);
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load sessions."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (roleLoading || !canFacilitate) return;
    void load();
  }, [roleLoading, canFacilitate]);

  useEffect(() => {
    const nextScenarioId = searchParams.get("scenario");
    const nextMode = searchParams.get("mode");
    const nextTier = searchParams.get("tier");

    if (nextScenarioId) setScenarioId(nextScenarioId);
    if (nextMode === "live" || nextMode === "rehearsal") setCreateMode(nextMode);
    if (nextTier === "5" || nextTier === "10" || nextTier === "15") setParticipantTier(nextTier);
  }, [searchParams]);

  useAutoRefresh(
    async () => {
      await load();
    },
    { enabled: !roleLoading && canFacilitate, intervalMs: 30000 }
  );

  const scenarioTitleById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const s of scenarios) m.set(s.id, s.title ?? null);
    return m;
  }, [scenarios]);

  const activeCount = useMemo(() => {
    return sessions.filter((s) => s.status === "live").length;
  }, [sessions]);

  const endedCount = useMemo(() => {
    return sessions.filter((s) => String(s.status ?? "").toLowerCase() === "ended").length;
  }, [sessions]);

  const availableLiveTiers = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of liveAccess) {
      if (item.status !== "active" || item.remaining_quantity <= 0) continue;
      map.set(item.participant_limit, (map.get(item.participant_limit) ?? 0) + item.remaining_quantity);
    }
    return map;
  }, [liveAccess]);

  const requestedTier = Number(participantTier);
  const canCreateLive =
    [5, 10, 15].includes(requestedTier) &&
    Array.from(availableLiveTiers.entries()).some(
      ([limit, remaining]) => remaining > 0 && limit >= requestedTier
    );

  const filteredSessions = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return sessions.filter((s) => {
      const st = normalizeSessionStatus(s.status);
      if (statusFilter !== "all" && st !== statusFilter) return false;

      if (!qq) return true;

      const scenarioTitle =
        s.scenario?.title ??
        (s.scenario_id ? scenarioTitleById.get(s.scenario_id) : null) ??
        "";
      const joinCode = String(s.join_code ?? "");
      const title = String(s.title ?? "");
      const id = String(s.id ?? "");

      return `${title}\n${scenarioTitle}\n${joinCode}\n${id}`.toLowerCase().includes(qq);
    });
  }, [sessions, q, statusFilter, scenarioTitleById]);

  async function onCreate() {
    if (!scenarioId) {
      setError("Select a scenario.");
      return;
    }
    const validTitle = validateSessionTitle(title);
    if (!validTitle.ok) {
      setError(validTitle.error);
      return;
    }
    setBusyId("create");
    setError(null);
    try {
      const id =
        createMode === "rehearsal"
          ? await createRehearsalSessionFromScenario({
              scenarioId,
              title: validTitle.value,
            })
          : await createLiveSessionFromScenario({
              scenarioId,
              title: validTitle.value,
              participantLimit: requestedTier,
            });
      await load();
      router.push(`/sessions/${id}`);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to create session."));
    } finally {
      setBusyId(null);
    }
  }

  async function onEnd(sessionId: string) {
    const session = sessions.find((item) => item.id === sessionId);
    setPendingConfirm({
      title: "End session?",
      description: `This closes "${session?.title ?? "Untitled session"}" for participants and stops the live exercise flow.`,
      confirmLabel: "End session",
      tone: "destructive",
      onConfirm: () => endNow(sessionId),
    });
  }

  async function endNow(sessionId: string) {
    setBusyId(sessionId);
    setError(null);
    try {
      await setSessionStatus(sessionId, "ended");
      await load();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to end session."));
    } finally {
      setBusyId(null);
    }
  }

  async function onRestart(sessionId: string) {
    const session = sessions.find((item) => item.id === sessionId);
    setPendingConfirm({
      title: "Restart session?",
      description: `This restarts "${session?.title ?? "Untitled session"}" and resets its runtime clock. Existing activity may remain in the session history.`,
      confirmLabel: "Restart session",
      onConfirm: () => restartNow(sessionId),
    });
  }

  async function restartNow(sessionId: string) {
    setBusyId(sessionId);
    setError(null);
    try {
      await restartSession(sessionId);
      await load();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to restart session."));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(sessionId: string) {
    const session = sessions.find((item) => item.id === sessionId);
    setPendingConfirm({
      title: "Delete session?",
      description: `This permanently deletes "${session?.title ?? "Untitled session"}" and its session data. This cannot be undone.`,
      confirmLabel: "Delete session",
      tone: "destructive",
      onConfirm: () => deleteNow(sessionId),
    });
  }

  async function deleteNow(sessionId: string) {
    setBusyId(sessionId);
    setError(null);
    try {
      await deleteSession(sessionId);
      await load();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to delete session."));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-background px-5 py-5 text-sm text-[color:var(--studio-muted)] shadow-[var(--studio-shadow)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-background px-5 py-4 shadow-[var(--studio-shadow)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-foreground">Need a guided first run?</div>
            <HintTooltip text="Use rehearsal if this is your first full-system test. Use live only when the scenario and participant access are already ready." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/facilitator/guide#launch">
                Open session guide
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/facilitator/guide#first-live">First live path</Link>
            </Button>
          </div>
        </div>
      </div>

      <SessionCreatePanel
        ids={ids}
        sessionsCount={sessions.length}
        activeCount={activeCount}
        endedCount={endedCount}
        scenarios={scenarios}
        scenarioId={scenarioId}
        setScenarioId={setScenarioId}
        title={title}
        setTitle={setTitle}
        createMode={createMode}
        setCreateMode={setCreateMode}
        participantTier={participantTier}
        setParticipantTier={setParticipantTier}
        canCreateLive={canCreateLive}
        availableLiveTiers={availableLiveTiers}
        busyId={busyId}
        onCreate={onCreate}
        scenarioSelectRef={scenarioSelectRef}
      />

      {error ? (
        <div className="notice notice-error">{error}</div>
      ) : null}

      <SessionLibrary
        filteredSessions={filteredSessions}
        scenariosAvailable={scenarios.length > 0}
        q={q}
        setQ={setQ}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        searchInputRef={searchInputRef}
        scenarioSelectRef={scenarioSelectRef}
        scenarioTitleById={scenarioTitleById}
        router={router}
        busyId={busyId}
        openMenuId={openMenuId}
        setOpenMenuId={setOpenMenuId}
        menuButtonRefs={menuButtonRefs}
        menuPanelRef={menuPanelRef}
        menuPanelPosition={menuPanelPosition}
        onEnd={onEnd}
        onRestart={onRestart}
        onDelete={onDelete}
      />

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title ?? ""}
        description={pendingConfirm?.description ?? ""}
        confirmLabel={pendingConfirm?.confirmLabel}
        tone={pendingConfirm?.tone}
        onOpenChange={(open) => {
          if (!open) setPendingConfirm(null);
        }}
        onConfirm={async () => {
          await pendingConfirm?.onConfirm();
        }}
      />
    </div>
  );
}
