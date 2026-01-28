// app/(app)/participant/page.tsx
"use client";

import { useRequireAuth } from "@/lib/useRequireAuth";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

export default function ParticipantPage() {
  const { loading, userId, email } = useRequireAuth();

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (!userId) {
    return (
      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Not authenticated</CardTitle>
          <CardDescription className="text-sm">Please sign in to continue.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => (window.location.href = "/login")}>
            Go to login
          </Button>
          <Button variant="secondary" onClick={() => (window.location.href = "/join")}>
            Join session
          </Button>
        </CardContent>
      </Card>
    );
  }

  const label = email ?? `Anonymous (${userId.slice(0, 8)})`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Participant</h1>
        <p className="text-sm text-muted-foreground">
          You are signed in and ready to join a live session.
        </p>
      </div>

      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Signed in</CardTitle>
          <CardDescription className="text-sm">Current identity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-3 text-sm font-semibold">
            {label}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => (window.location.href = "/join")}>
              Join session
            </Button>
            <Button variant="secondary" onClick={() => (window.location.href = "/facilitator")}>
              Facilitator
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            If you received a code from the facilitator, use “Join session”.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
