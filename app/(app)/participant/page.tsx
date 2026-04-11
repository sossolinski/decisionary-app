"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  listMyParticipantSessions,
  type ParticipantSession,
} from "@/lib/sessionsRuntime";
import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import HintTooltip from "@/app/components/HintTooltip";

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function errMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export default function ParticipantPage() {
  const router = useRouter();
  const { loading, userId, email, activeRole } = useRoleContext();

  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ParticipantSession[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    setBusy(true);
    try {
      const rows = await listMyParticipantSessions();
      setItems(rows ?? []);
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!loading && userId) void load();
  }, [loading, userId]);

  useAutoRefresh(
    async () => {
      await load();
    },
    { enabled: !loading && !!userId, intervalMs: 30000 }
  );

  if (loading) {
    return <div className="text-sm text-[hsl(var(--muted-foreground))]">Loading…</div>;
  }

  if (!userId || (activeRole !== "participant" && activeRole !== "admin")) {
    return (
      <div className="space-y-4">
        <div className="text-sm">Not authenticated. Please sign in to continue.</div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href="/login">Go to login</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/join">Join session</Link>
          </Button>
        </div>
      </div>
    );
  }

  const label = email ?? `Anonymous (${userId.slice(0, 8)})`;

  return (
    <div className="space-y-6">
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Participant</span>
            <HintTooltip text="This view shows your current participant identity and gives you a quick path into live sessions." />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="ui-section-label">
              Signed in · Current identity
            </div>
            <div className="font-medium">{label}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/join">Join session</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/facilitator">Facilitator</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>My sessions</span>
            <HintTooltip text="These are sessions you joined with a session code or were added to through the roster." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {err ? (
            <div className="text-sm text-[hsl(var(--destructive))]">{err}</div>
          ) : null}

          {items.length === 0 ? (
            <div className="ui-empty-state">
              No sessions yet. Use “Join session” if you received a code from the facilitator.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((s) => (
                <div
                  key={s.id}
                  className="ui-list-card flex flex-col gap-2 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {s.title ?? "Session"}
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      Status: {s.status} · Joined: {fmt(s.joined_at)}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => router.push(`/sessions/${s.id}`)}
                    >
                      Open
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigator.clipboard?.writeText(s.join_code)}
                      title="Copy join code"
                      aria-label={`Copy join code for session ${s.title}`}
                    >
                      Copy code
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
