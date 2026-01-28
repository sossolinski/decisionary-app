// app/(app)/facilitator/sessions/[id]/roster/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getMyRole } from "@/lib/users";
import {
  listSessionRoster,
  kickFromSession,
  type SessionRosterRow,
} from "@/lib/sessionsRuntime";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

export default function FacilitatorRosterPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const sessionId = params?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SessionRosterRow[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await listSessionRoster(sessionId);
      setRows(r ?? []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const role = await getMyRole();
      if (!role) {
        router.replace("/login");
        return;
      }
      if (role !== "facilitator") {
        router.replace("/participant");
        return;
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, sessionId]);

  async function onKick(participantId: string) {
    if (!confirm("Remove participant from this session?")) return;

    setBusyId(participantId);
    setError(null);
    try {
      await kickFromSession(sessionId, participantId);
      await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[var(--studio-max)] p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Roster</h1>
          <p className="text-sm text-muted-foreground">
            Participants currently registered in this session.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => router.push(`/sessions/${sessionId}`)}
          >
            Back to session
          </Button>
          <Button variant="secondary" onClick={load} disabled={!!busyId}>
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-[var(--radius)] border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.06)] px-4 py-3 text-sm font-semibold text-[hsl(var(--destructive))]">
          {error}
        </div>
      ) : null}

      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Participants</CardTitle>
          <CardDescription className="text-sm">
            {rows.length} total
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No participants yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Role</th>
                    <th className="px-4 py-3 text-left font-semibold">Joined</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => {
                    const isBusy = busyId === r.participant_id;
                    return (
                      <tr key={r.participant_id} className="border-b border-border">
                        <td className="px-4 py-3">
                          <div className="font-semibold">
                            {r.display_name ?? "Anonymous"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.participant_id}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-full border border-border bg-secondary px-2 py-1 text-xs font-semibold">
                            {r.role ?? "participant"}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">
                          {r.joined_at
                            ? new Date(r.joined_at).toLocaleString()
                            : "—"}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onKick(r.participant_id)}
                            disabled={isBusy}
                          >
                            {isBusy ? "..." : "Remove"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
