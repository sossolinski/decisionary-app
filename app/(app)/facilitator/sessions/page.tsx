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

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function StatusPill({ status }: { status?: string | null }) {
  const s = String(status ?? "—");
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium";
  const cls =
    s === "active"
      ? "border-[var(--studio-border)] bg-[var(--studio-highlight)]"
      : s === "ended"
      ? "border-[var(--studio-border)] bg-secondary/50"
      : "border-[var(--studio-border)] bg-[var(--studio-surface2)]";

  return <span className={`${base} ${cls}`}>{s}</span>;
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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [ses, scs] = await Promise.all([listSessions(), listScenarios()]);
      setSessions((ses ?? []) as Session[]);
      setScenarios((scs ?? []) as ScenarioListItem[]);
    } catch (e: any) {
      setError(e?.message ?? String(e));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const scenarioTitleById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const s of scenarios) m.set(s.id, s.title ?? null);
    return m;
  }, [scenarios]);

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
    } catch (e: any) {
      setError(e?.message ?? String(e));
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
    } catch (e: any) {
      setError(e?.message ?? String(e));
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
    } catch (e: any) {
      setError(e?.message ?? String(e));
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
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-[color:var(--studio-muted2)]">Loading…</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
          <p className="mt-1 text-sm text-[color:var(--studio-muted2)]">
            Create sessions from scenarios and manage exercise lifecycle.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={load}
            disabled={busyId === "refresh"}
            title="Refresh"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="rounded-[14px] border border-[var(--studio-border)] bg-destructive/10 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {/* Create session */}
      <Card>
        <CardHeader>
          <CardTitle>Create session</CardTitle>
          <CardDescription>
            Choose scenario and start a new run.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <div className="text-xs font-medium text-[color:var(--studio-muted2)] mb-2">
                Scenario
              </div>
              <select
                value={scenarioId}
                onChange={(e) => setScenarioId(e.target.value)}
                className={[
                  "h-10 w-full rounded-[var(--radius)] px-3 text-sm",
                  "border border-[var(--studio-border)]",
                  "bg-[var(--studio-surface2)]",
                  "text-foreground",
                  "focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]",
                ].join(" ")}
              >
                <option value="">Select scenario…</option>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title ?? "Untitled scenario"}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <div className="text-xs font-medium text-[color:var(--studio-muted2)] mb-2">
                Title
              </div>
              <div className="flex gap-2">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="New session"
                />
                <Button onClick={onCreate} disabled={busyId === "create"}>
                  {busyId === "create" ? "…" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions list */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-[color:var(--studio-muted2)]">
          <span className="font-medium text-foreground">All sessions</span>{" "}
          <span className="ml-2">{sessions.length} total</span>
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-sm text-[color:var(--studio-muted2)]">
              No sessions yet.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sessions.map((s) => {
            const isBusy = busyId === s.id;

            const scenarioTitle =
              s.scenario?.title ??
              (s.scenario_id ? scenarioTitleById.get(s.scenario_id) : null) ??
              "—";

            return (
              <Card key={s.id}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base truncate">
                        {s.title ?? "Untitled session"}
                      </CardTitle>
                      <StatusPill status={s.status ?? null} />
                    </div>

                    <div className="mt-1 text-sm text-[color:var(--studio-muted2)]">
                      Scenario: <span className="text-foreground">{scenarioTitle}</span>
                      {" · "}
                      Join code: <span className="text-foreground">{s.join_code}</span>
                    </div>

                    <div className="mt-2 text-xs text-[color:var(--studio-muted2)]">
                      Created: {fmt(s.created_at)} {" · "}
                      Started: {fmt(s.started_at)} {" · "}
                      Ended: {fmt(s.ended_at)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => router.push(`/sessions/${s.id}`)}
                      disabled={isBusy}
                    >
                      Open
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        router.push(`/facilitator/sessions/${s.id}/roster`)
                      }
                      disabled={isBusy}
                    >
                      Roster
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => onEnd(s.id)}
                      disabled={isBusy}
                    >
                      End
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => onRestart(s.id)}
                      disabled={isBusy}
                    >
                      Restart
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => onDelete(s.id)}
                      disabled={isBusy}
                    >
                      Delete
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
