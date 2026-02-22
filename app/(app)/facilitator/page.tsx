"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getMyRole } from "@/lib/users";
import { listScenarios, listSessions } from "@/lib/sessionsRuntime";
import { toErrorMessage } from "@/lib/error-utils";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

export default function FacilitatorHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [scenarioCount, setScenarioCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function loadCounts() {
    setError(null);
    try {
      const [sc, se] = await Promise.all([listScenarios(), listSessions()]);
      setScenarioCount((sc ?? []).length);
      setSessionCount((se ?? []).length);
    } catch (error: unknown) {
      setError(toErrorMessage(error, "Failed to load facilitator dashboard data."));
    }
  }

  useEffect(() => {
    (async () => {
      const role = await getMyRole();
      if (!role) return router.replace("/login");
      if (role !== "facilitator") return router.replace("/participant");
      await loadCounts();
      setLoading(false);
    })();
  }, [router]);

  return (
    <div className="space-y-6">
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Facilitator workspace</CardTitle>
          <CardDescription>
            Build scenarios, run sessions, and coordinate the exercise flow — all
            in one place.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary">
              <Link href="/facilitator/sessions">Go to Sessions</Link>
            </Button>

            <Button asChild variant="secondary">
              <Link href="/facilitator/scenarios">Manage Scenarios</Link>
            </Button>

            <Button
              variant="secondary"
              onClick={async () => {
                setLoading(true);
                await loadCounts();
                setLoading(false);
              }}
            >
              Refresh
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="surface2 rounded-[var(--radius)] px-4 py-3 text-center shadow-soft">
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                Scenarios
              </div>
              <div className="text-2xl font-semibold">
                {loading ? "—" : scenarioCount}
              </div>
            </div>

            <div className="surface2 rounded-[var(--radius)] px-4 py-3 text-center shadow-soft">
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                Sessions
              </div>
              <div className="text-2xl font-semibold">
                {loading ? "—" : sessionCount}
              </div>
            </div>
          </div>
        </CardContent>

        {error ? (
          <div className="px-6 pb-6 text-sm text-[hsl(var(--destructive))]">
            {error}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>1. Prepare</CardTitle>
            <CardDescription>
              Build scenarios and inject libraries for realistic runs.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              Create and iterate on content.
            </span>
            <Button asChild variant="secondary" size="sm">
              <Link href="/facilitator/scenarios">Scenarios</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>2. Run</CardTitle>
            <CardDescription>
              Start a session, invite participants, deliver injects.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              Lifecycle control & tools.
            </span>
            <Button asChild variant="secondary" size="sm">
              <Link href="/facilitator/sessions">Sessions</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>3. Review</CardTitle>
            <CardDescription>
              Capture actions, decisions, and key timeline points.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-[hsl(var(--muted-foreground))]">
            (Next) Add After-Action Report & exports.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
