// app/(app)/participant/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getMyRole } from "@/lib/users";
import { supabase } from "@/lib/supabaseClient";
import { listMyParticipantSessions, type ParticipantSession } from "@/lib/sessionsRuntime";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

export default function ParticipantHomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ParticipantSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);

      const ps = await listMyParticipantSessions();
      setSessions((ps ?? []) as ParticipantSession[]);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  useEffect(() => {
    (async () => {
      const role = await getMyRole();
      if (!role) return router.replace("/login");
      if (role !== "participant") return router.replace("/facilitator");

      await load();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const active = sessions.find((s) => s.status === "active") ?? null;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-[var(--studio-radius)] border border-[var(--studio-border)] bg-[var(--studio-highlight)] shadow-soft p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              Participant workspace
            </h1>
            <p className="mt-2 text-sm text-[color:var(--studio-muted2)]">
              Join a session, respond to injects, and log actions as the scenario unfolds.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button asChild>
                <Link href="/join">Join a session</Link>
              </Button>
              {active ? (
                <Button variant="outline" asChild>
                  <Link href={`/sessions/${active.id}`}>Open active session</Link>
                </Button>
              ) : null}
              <Button
                variant="secondary"
                onClick={async () => {
                  setLoading(true);
                  await load();
                  setLoading(false);
                }}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* mini identity */}
          <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3 w-full sm:w-auto">
            <div className="text-xs text-[color:var(--studio-muted2)]">Signed in</div>
            <div className="mt-1 text-sm font-medium truncate max-w-[340px]">
              {loading ? "—" : email ?? "—"}
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-[14px] border border-[var(--studio-border)] bg-destructive/10 px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}
      </div>

      {/* Active session */}
      {active ? (
        <Card>
          <CardHeader>
            <CardTitle>Active session</CardTitle>
            <CardDescription>You currently have an active session.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-[color:var(--studio-muted2)]">
              <span className="text-foreground font-medium">{active.title ?? "Session"}</span>
              {" · "}
              Joined: <span className="text-foreground">{fmt(active.joined_at)}</span>
            </div>
            <Button asChild>
              <Link href={`/sessions/${active.id}`}>Open</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No active session</CardTitle>
            <CardDescription>
              Join using a join code provided by the facilitator.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="text-sm text-[color:var(--studio-muted2)]">
              Ready when you are.
            </div>
            <Button asChild>
              <Link href="/join">Join</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Your sessions</CardTitle>
          <CardDescription>Recent sessions you’ve joined.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-sm text-[color:var(--studio-muted2)]">
              Nothing here yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {sessions.slice(0, 10).map((s) => (
                <div
                  key={s.id}
                  className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {s.title ?? "Session"}
                    </div>
                    <div className="text-xs text-[color:var(--studio-muted2)] mt-1">
                      Status: <span className="text-foreground">{s.status ?? "—"}</span>
                      {" · "}
                      Joined: <span className="text-foreground">{fmt(s.joined_at)}</span>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href={`/sessions/${s.id}`}>Open</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
