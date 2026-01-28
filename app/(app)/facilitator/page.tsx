// app/(app)/facilitator/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getMyRole } from "@/lib/users";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

export default function FacilitatorOverviewPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const role = await getMyRole();
      if (!role) return router.replace("/login");
      if (role !== "facilitator") return router.replace("/participant");
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Facilitator</h1>
        <p className="text-sm text-muted-foreground">Manage scenarios and run sessions.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="surface shadow-soft border border-[var(--studio-border)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Scenarios</CardTitle>
            <CardDescription className="text-sm">
              Build and maintain your scenario library.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => router.push("/facilitator/scenarios")}>
              Open scenarios
            </Button>
            <Button variant="secondary" onClick={() => router.push("/facilitator/scenarios")}>
              Manage sharing
            </Button>
          </CardContent>
        </Card>

        <Card className="surface shadow-soft border border-[var(--studio-border)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sessions</CardTitle>
            <CardDescription className="text-sm">
              Create sessions from scenarios and facilitate exercises.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => router.push("/facilitator/sessions")}>
              Open sessions
            </Button>
            <Button variant="secondary" onClick={() => router.push("/facilitator/sessions")}>
              Roster & controls
            </Button>
          </CardContent>
        </Card>

        <Card className="surface shadow-soft border border-[var(--studio-border)] lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Participant join</CardTitle>
            <CardDescription className="text-sm">
              Share join code with participants to enter an active session.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => router.push("/join")}>
              Go to join page
            </Button>
            <Button variant="secondary" onClick={() => router.push("/participant")}>
              Participant view
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
