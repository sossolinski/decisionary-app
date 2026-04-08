// app/(app)/facilitator/sessions/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getMyRole } from "@/lib/users";
import {
  listSessions,
  listScenarios,
  createSessionFromScenario,
  setSessionStatus,
  restartSession,
  deleteSession,
  type Session,
  type ScenarioListItem,
} from "@/lib/sessionsRuntime";
import { getErrorMessage } from "@/lib/errors";
import { normalizeSessionStatus, type SessionStatus } from "@/lib/sessionStatus";
import { validateSessionTitle } from "@/lib/validators";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

import {
  CalendarPlus,
  RefreshCw,
  Play,
  Users,
  Square,
  RotateCcw,
  Trash2,
  Search,
  X,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
  ClipboardList,
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

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);

  const [scenarioId, setScenarioId] = useState("");
  const [title, setTitle] = useState("New session");

  // UI: quick filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // UI: minimal actions toggle per-row
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [ses, scs] = await Promise.all([listSessions(), listScenarios()]);
      setSessions((ses ?? []) as Session[]);
      setScenarios((scs ?? []) as ScenarioListItem[]);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load sessions."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const role = await getMyRole();
      if (!role) return router.replace("/login");
      if (role !== "facilitator" && role !== "admin") return router.replace("/participant");
      await load();
    })();
  }, [router]);

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

  const draftCount = useMemo(() => {
    return sessions.filter((s) => normalizeSessionStatus(s.status) === "draft").length;
  }, [sessions]);

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
      const id = await createSessionFromScenario({
        scenarioId,
        title: validTitle.value,
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
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--studio-border)] bg-background/80 px-3 py-1 text-xs font-semibold text-[color:var(--studio-muted)]">
                <Sparkles className="h-3.5 w-3.5" />
                Session control
              </div>

              <div className="space-y-2">
                <h1 className="text-[28px] font-semibold tracking-tight">Move cleanly from planning into live exercise runs.</h1>
                <p className="max-w-[62ch] text-sm leading-7 text-[color:var(--studio-muted)]">
                  Create sessions from scenarios, distribute join codes, and manage the exercise lifecycle without leaving the operations surface.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={load} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="surface2 rounded-[16px] px-4 py-4 shadow-soft">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)]">
                  Total
                </div>
                <div className="mt-2 text-3xl font-semibold">{sessions.length}</div>
              </div>

              <div className="surface2 rounded-[16px] px-4 py-4 shadow-soft">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)]">
                  Draft
                </div>
                <div className="mt-2 text-3xl font-semibold">{draftCount}</div>
              </div>

              <div className="surface2 rounded-[16px] px-4 py-4 shadow-soft">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)]">
                  Live
                </div>
                <div className="mt-2 text-3xl font-semibold">{activeCount}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--studio-border)] px-5 py-4 md:px-6">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)]">
              Create session
            </div>
            <div className="grid gap-3 md:grid-cols-12">
              <div className="md:col-span-7">
                <Select value={scenarioId} onChange={setScenarioId}>
                  <option value="">Select scenario…</option>
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title ?? "Untitled scenario"}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="md:col-span-5">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="New session"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={onCreate} disabled={busyId === "create"} className="gap-2">
                <Play className="h-4 w-4" />
                {busyId === "create" ? "…" : "Create & open"}
              </Button>
              <div className="text-xs text-[color:var(--studio-muted2)]">
                Create a run, then invite participants with the join code.
              </div>
            </div>
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
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 opacity-80" />
                Session library
              </CardTitle>
              <CardDescription>Search, open, and manage exercise runs.</CardDescription>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-[300px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
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
            <div className="text-sm text-muted-foreground">
              No sessions matching current filters.
            </div>
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
                        <StatusPill status={status} />
                      </div>

                      <div className="mt-2 text-sm leading-6 text-muted-foreground">
                        <span className="font-medium text-foreground">Scenario:</span>{" "}
                        {scenarioTitle}
                        <span className="mx-2 text-muted-foreground/70">•</span>
                        <span className="font-medium text-foreground">Join code:</span>{" "}
                        <span className="font-mono">{joinCode}</span>
                      </div>

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

                      <CopyButton value={joinCode} label="Join code" />

                      {/* More (minimize button spam) */}
                      <div className={openMenuId === s.id ? "relative z-20" : "relative"}>
                        <Button
                          variant="outline"
                          onClick={() => setOpenMenuId((v) => (v === s.id ? null : s.id))}
                          className="gap-2"
                          disabled={isBusy}
                        >
                          More <ChevronDown className="h-4 w-4 opacity-70" />
                        </Button>

                        {openMenuId === s.id ? (
                          <div className="absolute right-0 mt-2 w-[220px] popover-solid rounded-[14px] shadow-soft overflow-hidden z-50">
                            <div className="p-2 space-y-1">
                              <Button
                                variant="outline"
                                className="w-full justify-start gap-2"
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
                                variant="outline"
                                className="w-full justify-start gap-2"
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
                                className="w-full justify-start gap-2"
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
                          </div>
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
