// app/(app)/facilitator/sessions/page.tsx
"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";

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
import { normalizeSessionStatus, type SessionStatus } from "@/lib/sessionStatus";
import { validateSessionTitle } from "@/lib/validators";
import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import HintTooltip from "@/app/components/HintTooltip";

import {
  CalendarPlus,
  Play,
  Users,
  ClipboardList,
  Square,
  RotateCcw,
  Trash2,
  Search,
  X,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
} from "lucide-react";

type StatusFilter = "all" | "live" | "ended";

function toStatusFilter(value: string): StatusFilter {
  return value === "live" || value === "ended" ? value : "all";
}

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function statusTone(status?: SessionStatus | null) {
  const s = normalizeSessionStatus(status);
  if (s === "live")
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (s === "ended")
    return "border-border bg-secondary/50 text-foreground";
  if (s === "unknown")
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-[var(--studio-border)] bg-[var(--studio-surface2)] text-foreground";
}

function StatusPill({ status }: { status?: SessionStatus | null }) {
  const s = normalizeSessionStatus(status);
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide";
  return <span className={`${base} ${statusTone(s)}`}>{s.toUpperCase()}</span>;
}

function ModePill({
  mode,
}: {
  mode: "rehearsal" | "live";
}) {
  const cls =
    mode === "rehearsal"
      ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
      : "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide ${cls}`}>
      {mode === "rehearsal" ? "REHEARSAL" : "LIVE EXERCISE"}
    </span>
  );
}

function Select({
  id,
  inputRef,
  value,
  onChange,
  children,
}: {
  id?: string;
  inputRef?: React.RefObject<HTMLSelectElement | null>;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      ref={inputRef}
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

function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        } catch {}
      }}
      title={value}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

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
    if (!confirm("End this session?")) return;
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
    if (!confirm("Restart this session?")) return;
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
    if (!confirm("Delete this session? This cannot be undone.")) return;
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
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
        <div className="relative px-5 py-5 md:px-6 md:py-6">
          <div className="pointer-events-none absolute right-0 top-0 h-28 w-52 rounded-bl-[28px] bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_62%)]" />
          <div className="relative grid gap-5 lg:grid-cols-[1.3fr_0.9fr] lg:items-start">
            <div className="space-y-4">
              <div className="ui-eyebrow">
                <Sparkles className="h-3.5 w-3.5" />
                Session control
                <HintTooltip
                  text="Create sessions from scenarios, distribute join codes, and manage the exercise lifecycle without leaving the operations surface."
                  side="right"
                />
              </div>

              <div className="space-y-2">
                <h1 className="text-[28px] font-semibold tracking-tight">Move cleanly from planning into live exercise runs.</h1>
              </div>

            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="ui-metric-card">
                <div className="ui-metric-label">
                  Total
                </div>
                <div className="mt-2 text-3xl font-semibold">{sessions.length}</div>
              </div>

              <div className="ui-metric-card">
                <div className="ui-metric-label">
                  Live
                </div>
                <div className="mt-2 text-3xl font-semibold">{activeCount}</div>
              </div>

              <div className="ui-metric-card">
                <div className="ui-metric-label">
                  Ended
                </div>
                <div className="mt-2 text-3xl font-semibold">{endedCount}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--studio-border)] px-5 py-4 md:px-6">
          <div id="create-session" className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="ui-section-label">
                  Create session
                </div>
                <HintTooltip
                  text="Use rehearsal for a solo dry run, or start a paid live exercise when your organization has access."
                  side="right"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={createMode === "rehearsal" ? "default" : "outline"}
                onClick={() => setCreateMode("rehearsal")}
              >
                Rehearsal
              </Button>
              <Button
                type="button"
                variant={createMode === "live" ? "default" : "outline"}
                onClick={() => setCreateMode("live")}
              >
                Live exercise
              </Button>
            </div>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.75fr)_auto] xl:items-center">
              <div>
                <Select id={`${ids}-scenario`} inputRef={scenarioSelectRef} value={scenarioId} onChange={setScenarioId}>
                  <option value="">Select scenario…</option>
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title ?? "Untitled scenario"}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                {createMode === "rehearsal" ? (
                  <Input
                    id={`${ids}-title`}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="New rehearsal"
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                    <Input
                      id={`${ids}-title`}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="New live exercise"
                    />
                    <Select value={participantTier} onChange={setParticipantTier}>
                      <option value="5">Up to 5</option>
                      <option value="10">Up to 10</option>
                      <option value="15">Up to 15</option>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={onCreate}
                  disabled={busyId === "create" || (createMode === "live" && !canCreateLive)}
                  className="gap-2 xl:w-auto"
                >
                  <Play className="h-4 w-4" />
                  {busyId === "create" ? "…" : createMode === "rehearsal" ? "Create rehearsal" : "Create live"}
                </Button>
                <HintTooltip
                  text={
                    createMode === "rehearsal"
                      ? "Rehearsal mode is free and limited to the creator only."
                      : "Live exercise creation consumes one eligible organization entitlement and unlocks participant joins up to the purchased tier."
                  }
                  side="left"
                />
              </div>
            </div>

            {createMode === "live" ? (
              <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3 text-sm text-[color:var(--studio-muted)]">
                {canCreateLive ? (
                  <span>
                    Live access available. Matching entitlements:
                    {" "}
                    {[5, 10, 15]
                      .filter((limit) => (availableLiveTiers.get(limit) ?? 0) > 0)
                      .map((limit) => `${limit}p x${availableLiveTiers.get(limit) ?? 0}`)
                      .join(" • ")}
                  </span>
                ) : (
                  <span>
                    This organization does not currently have a live exercise entitlement for the selected participant tier.
                    Ask an admin to grant access or create a billing order first.
                  </span>
                )}
              </div>
            ) : (
              <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3 text-sm text-[color:var(--studio-muted)]">
                Rehearsal mode runs the full session flow, but only the creator can join and participant invitations stay disabled.
              </div>
            )}

            {scenarios.length === 0 ? (
              <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3 text-sm text-[color:var(--studio-muted)]">
                You do not have any scenarios yet. Create one first so this workspace can launch a session.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="notice notice-error">{error}</div>
      ) : null}

      {/* Sessions list */}
      <Card className="surface shadow-soft border border-[var(--studio-border)] overflow-visible">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 xl:flex xl:min-h-10 xl:items-center">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 opacity-80" />
                Session library
                <HintTooltip text="Search, open, and manage exercise runs from one place." />
              </CardTitle>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-[300px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search sessions…"
                  className="pl-9"
                />
              </div>

              <div className="w-full sm:w-[180px]">
                <Select value={statusFilter} onChange={(v) => setStatusFilter(toStatusFilter(v))}>
                  <option value="all">Status: All</option>
                  <option value="live">Status: Live</option>
                  <option value="ended">Status: Ended</option>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {(q.trim() || statusFilter !== "all") ? (
            <div className="flex flex-wrap gap-2">
              {q.trim() ? (
                <Chip label={`Search: ${q.trim()}`} onClear={() => setQ("")} />
              ) : null}
              {statusFilter !== "all" ? (
                <Chip label={`Status: ${statusFilter}`} onClear={() => setStatusFilter("all")} />
              ) : null}
            </div>
          ) : null}

          {filteredSessions.length === 0 ? (
            q.trim() || statusFilter !== "all" ? (
              <div className="rounded-[16px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-4">
                <div className="text-sm font-medium text-foreground">No sessions match the current filters.</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Clear the search or status filter to get back to the full session library.
                </div>
                <div className="mt-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQ("");
                      setStatusFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-[16px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-4">
                <div className="text-sm font-medium text-foreground">No sessions yet.</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Launch your first exercise run from a scenario above, then come back here to manage it.
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() => scenarioSelectRef.current?.focus()}
                    disabled={scenarios.length === 0}
                  >
                    Create first session
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/facilitator/scenarios")}>
                    Open scenarios
                  </Button>
                </div>
              </div>
            )
          ) : (
            filteredSessions.map((s) => {
              const isBusy = busyId === s.id;

              const scenarioTitle =
                s.scenario?.title ??
                (s.scenario_id ? scenarioTitleById.get(s.scenario_id) : null) ??
                "—";

              const joinCode = String(s?.join_code ?? "—");
              const status = s.status ?? null;

              return (
                <div
                  key={s.id}
                  className="rounded-[16px] border border-[var(--studio-border)] bg-[var(--studio-surface)] px-4 py-4 transition-transform duration-150 hover:-translate-y-[1px] md:px-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-lg font-semibold tracking-tight truncate">
                          {s.title ?? "Untitled session"}
                        </div>
                        <ModePill mode={s.session_mode} />
                        <StatusPill status={status} />
                      </div>

                      <div className="mt-2 text-sm leading-6 text-muted-foreground">
                        <span className="font-medium text-foreground">Scenario:</span>{" "}
                        {scenarioTitle}
                      </div>

                      {s.session_mode === "live" ? (
                        <div className="mt-1.5 text-sm leading-6 text-muted-foreground">
                          <span className="font-medium text-foreground">Join code:</span>{" "}
                          <span className="font-mono tracking-[0.08em]">{joinCode}</span>
                          {typeof s.participant_limit === "number" ? (
                            <span className="ml-2">· participant cap {s.participant_limit}</span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-1.5 text-sm leading-6 text-muted-foreground">
                          <span className="font-medium text-foreground">Access:</span> Rehearsal mode · creator only
                        </div>
                      )}

                      <div className="mt-3 text-xs text-muted-foreground">
                        Created: {fmt(s.created_at)} <span className="mx-2">•</span>
                        Started: {fmt(s.started_at)} <span className="mx-2">•</span>
                        Ended: {fmt(s.ended_at)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <Button
                        variant="secondary"
                        onClick={() => router.push(`/sessions/${s.id}`)}
                        disabled={isBusy}
                        className="gap-2"
                      >
                        <Play className="h-4 w-4" />
                        Open
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => router.push(`/facilitator/sessions/${s.id}/roster`)}
                        disabled={isBusy}
                        className="gap-2"
                      >
                        <Users className="h-4 w-4" />
                        Roster
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => router.push(`/facilitator/sessions/${s.id}/review`)}
                        disabled={isBusy}
                        className="gap-2"
                      >
                        <ClipboardList className="h-4 w-4" />
                        Review
                      </Button>

                      {s.session_mode === "live" ? <CopyButton value={joinCode} label="Join code" /> : null}

                      {/* More (minimize button spam) */}
                      <div className="relative">
                        <Button
                          ref={(node) => {
                            menuButtonRefs.current[s.id] = node;
                          }}
                          variant="outline"
                          onClick={() => setOpenMenuId((v) => (v === s.id ? null : s.id))}
                          className="gap-2"
                          disabled={isBusy}
                          aria-haspopup="dialog"
                          aria-expanded={openMenuId === s.id}
                          aria-controls={openMenuId === s.id ? `session-actions-${s.id}` : undefined}
                        >
                          More <ChevronDown className="h-4 w-4 opacity-70" />
                        </Button>

                        {openMenuId === s.id && typeof document !== "undefined"
                          ? createPortal(
                          <div
                            id={`session-actions-${s.id}`}
                            ref={menuPanelRef}
                            role="dialog"
                            aria-label={`Actions for session ${s.title}`}
                            className="fixed z-[110] w-[220px] rounded-[16px] border border-[var(--studio-border-strong)] bg-[hsl(var(--popover)/0.98)] p-1.5 shadow-[0_16px_40px_hsl(220_20%_20%/0.14)] backdrop-blur-sm"
                            style={
                              menuPanelPosition
                                ? {
                                    top: `${menuPanelPosition.top}px`,
                                    left: `${menuPanelPosition.left}px`,
                                  }
                                : {
                                    top: "-9999px",
                                    left: "-9999px",
                                  }
                            }
                          >
                            <div className="space-y-1">
                              <Button
                                variant="ghost"
                                className="w-full justify-start gap-2 rounded-[12px] border border-transparent px-3"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onEnd(s.id);
                                }}
                                disabled={isBusy || String(status ?? "").toLowerCase() === "ended"}
                                title="End session"
                              >
                                <Square className="h-4 w-4" />
                                End
                              </Button>

                              <Button
                                variant="ghost"
                                className="w-full justify-start gap-2 rounded-[12px] border border-transparent px-3"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onRestart(s.id);
                                }}
                                disabled={isBusy}
                                title="Restart session"
                              >
                                <RotateCcw className="h-4 w-4" />
                                Restart
                              </Button>

                              <Button
                                variant="destructive"
                                className="w-full justify-start gap-2 rounded-[12px] px-3"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onDelete(s.id);
                                }}
                                disabled={isBusy}
                                title="Delete session"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </div>,
                          document.body
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
