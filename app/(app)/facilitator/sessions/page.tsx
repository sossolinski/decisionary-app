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
      setSessions(ses ?? []);
      setScenarios(scs ?? []);
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
    const m = new Map<string, string>();
    for (const s of scenarios) m.set(s.id, s.title);
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
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Create sessions from scenarios and manage exercise lifecycle.
          </p>
        </div>

        <Button variant="secondary" onClick={load} disabled={!!busyId}>
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-[var(--radius)] border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.06)] px-4 py-3 text-sm font-semibold text-[hsl(var(--destructive))]">
          {error}
        </div>
      ) : null}

      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Create session</CardTitle>
          <CardDescription className="text-sm">
            Choose scenario and start a new run.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1 md:col-span-2">
            <div className="text-sm font-semibold">Scenario</div>
            <select
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              className="h-10 w-full rounded-[var(--radius)] border border-border bg-background px-3 text-sm"
            >
              <option value="">Select scenario…</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-semibold">Title</div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="md:col-span-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={onCreate} disabled={busyId === "create"}>
              {busyId === "create" ? "..." : "Create"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All sessions</CardTitle>
          <CardDescription className="text-sm">{sessions.length} total</CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {sessions.length === 0 ? (
            <div className="text-sm text-muted-foreground">No sessions yet.</div>
          ) : (
            <div className="grid gap-3">
              {sessions.map((s) => {
                const isBusy = busyId === s.id;

                return (
                  <div
                    key={s.id}
                    className="rounded-[var(--radius)] border border-border bg-card px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-extrabold">
                          {s.title ?? "Untitled session"}
                          <span className="opacity-60"> · {String(s.status ?? "—")}</span>
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          Scenario:{" "}
                          <b>
                            {s.scenario?.title ??
                              (s.scenario_id ? scenarioTitleById.get(s.scenario_id) : null) ??
                              "—"}
                          </b>
                          {" · "}
                          Join code: <b>{s.join_code}</b>
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          Created: <b>{fmt(s.created_at)}</b>
                          {" · "}
                          Started: <b>{fmt(s.started_at)}</b>
                          {" · "}
                          Ended: <b>{fmt(s.ended_at)}</b>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="primary"
                          onClick={() => router.push(`/sessions/${s.id}`)}
                          disabled={isBusy}
                        >
                          Open
                        </Button>

                        <Button
                          variant="secondary"
                          onClick={() => router.push(`/facilitator/sessions/${s.id}/roster`)}
                          disabled={isBusy}
                        >
                          Roster
                        </Button>

                        <Button variant="warning" onClick={() => onEnd(s.id)} disabled={isBusy}>
                          End
                        </Button>

                        <Button variant="warning" onClick={() => onRestart(s.id)} disabled={isBusy}>
                          Restart
                        </Button>

                        <Button variant="danger" onClick={() => onDelete(s.id)} disabled={isBusy}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
