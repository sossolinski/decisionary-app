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
} from "lucide-react";

type StatusFilter = "all" | "active" | "ended";

function errMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function toStatusFilter(value: string): StatusFilter {
  return value === "active" || value === "ended" ? value : "all";
}

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function statusTone(status?: string | null) {
  const s = String(status ?? "").toLowerCase();
  if (s === "active")
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (s === "ended")
    return "border-border bg-secondary/50 text-foreground";
  return "border-[var(--studio-border)] bg-[var(--studio-surface2)] text-foreground";
}

function StatusPill({ status }: { status?: string | null }) {
  const s = String(status ?? "—");
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide";
  return <span className={`${base} ${statusTone(status)}`}>{s.toUpperCase()}</span>;
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
      setError(errMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const role = await getMyRole();
      if (!role) return router.replace("/login");
      if (role !== "facilitator") return router.replace("/participant");
      await load();
    })();
  }, [router]);

  const scenarioTitleById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const s of scenarios) m.set(s.id, s.title ?? null);
    return m;
  }, [scenarios]);

  const activeCount = useMemo(() => {
    return sessions.filter((s) => String(s.status ?? "").toLowerCase() === "active").length;
  }, [sessions]);

  const endedCount = useMemo(() => {
    return sessions.filter((s) => String(s.status ?? "").toLowerCase() === "ended").length;
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return sessions.filter((s) => {
      const st = String(s.status ?? "").toLowerCase();
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
    setBusyId("create");
    setError(null);
    try {
      const id = await createSessionFromScenario({
        scenarioId,
        title: title.trim() || "New session",
      });
      await load();
      router.push(`/sessions/${id}`);
    } catch (e: unknown) {
      setError(errMessage(e));
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
      setError(errMessage(e));
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
      setError(errMessage(e));
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
      setError(errMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create sessions from scenarios and manage exercise lifecycle.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              Total: <span className="text-foreground">{sessions.length}</span>
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs font-semibold text-muted-foreground">
              Active: <span className="text-foreground">{activeCount}</span>
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs font-semibold text-muted-foreground">
              Ended: <span className="text-foreground">{endedCount}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {/* Create session */}
      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 opacity-80" />
            Create session
          </CardTitle>
          <CardDescription>Choose scenario and start a new run.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-7 space-y-2">
              <div className="text-sm font-medium">Scenario</div>
              <Select value={scenarioId} onChange={setScenarioId}>
                <option value="">Select scenario…</option>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title ?? "Untitled scenario"}
                  </option>
                ))}
              </Select>
            </div>

            <div className="md:col-span-5 space-y-2">
              <div className="text-sm font-medium">Title</div>
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
            <div className="text-xs text-muted-foreground">
              Tip: you can invite participants with the join code after creating.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions list */}
      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 opacity-80" />
              Sessions{" "}
              <span className="text-muted-foreground font-normal">
                {filteredSessions.length} shown
              </span>
            </CardTitle>
            <CardDescription>Search and manage runs (open, roster, end, restart, delete).</CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <div className="relative w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search sessions…"
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onChange={(v) => setStatusFilter(toStatusFilter(v))}>
              <option value="all">Status: All</option>
              <option value="active">Status: Active</option>
              <option value="ended">Status: Ended</option>
            </Select>
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
                  className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface)] px-4 py-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold truncate">
                          {s.title ?? "Untitled session"}
                        </div>
                        <StatusPill status={status} />
                      </div>

                      <div className="mt-1 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Scenario:</span>{" "}
                        {scenarioTitle}
                        <span className="mx-2 text-muted-foreground/70">•</span>
                        <span className="font-medium text-foreground">Join code:</span>{" "}
                        <span className="font-mono">{joinCode}</span>
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground">
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
                      <div className="relative">
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
