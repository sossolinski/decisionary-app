// app/(app)/facilitator/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getMyRole } from "@/lib/users";
import { listScenarios, listSessions } from "@/lib/sessionsRuntime";

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
  const [scenarioCount, setScenarioCount] = useState<number>(0);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  async function loadCounts() {
    setError(null);
    try {
      const [sc, se] = await Promise.all([listScenarios(), listSessions()]);
      setScenarioCount((sc ?? []).length);
      setSessionCount((se ?? []).length);
    } catch (e: any) {
      setError(e?.message ?? String(e));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-[var(--studio-radius)] border border-[var(--studio-border)] bg-[var(--studio-highlight)] shadow-soft p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              Facilitator workspace
            </h1>
            <p className="mt-2 text-sm text-[color:var(--studio-muted2)]">
              Build scenarios, run sessions, and coordinate the exercise flow —
              all in one place.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button asChild>
                <Link href="/facilitator/sessions">Go to Sessions</Link>
              </Button>
              <Button variant="outline" asChild>
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
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
            <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3">
              <div className="text-xs text-[color:var(--studio-muted2)]">
                Scenarios
              </div>
              <div className="mt-1 text-xl font-semibold">
                {loading ? "—" : scenarioCount}
              </div>
            </div>
            <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-4 py-3">
              <div className="text-xs text-[color:var(--studio-muted2)]">
                Sessions
              </div>
              <div className="mt-1 text-xl font-semibold">
                {loading ? "—" : sessionCount}
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-[14px] border border-[var(--studio-border)] bg-destructive/10 px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>1. Prepare</CardTitle>
            <CardDescription>
              Build scenarios and inject libraries for realistic runs.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="text-sm text-[color:var(--studio-muted2)]">
              Create and iterate on content.
            </div>
            <Button variant="outline" asChild>
              <Link href="/facilitator/scenarios">Scenarios</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Run</CardTitle>
            <CardDescription>
              Start a session, invite participants, deliver injects.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="text-sm text-[color:var(--studio-muted2)]">
              Lifecycle control & tools.
            </div>
            <Button asChild>
              <Link href="/facilitator/sessions">Sessions</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Review</CardTitle>
            <CardDescription>
              Capture actions, decisions, and key timeline points.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-[color:var(--studio-muted2)]">
              (Next) Add After-Action Report & exports.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Helpful note */}
      <Card>
        <CardHeader>
          <CardTitle>Quick tips</CardTitle>
          <CardDescription>Small things that improve the run.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-2 text-sm text-[color:var(--studio-muted2)]">
            <li>
              Keep scenario title short; use description for context and scope.
            </li>
            <li>
              Start sessions from scenarios — it keeps content reusable and
              versionable.
            </li>
            <li>
              Use roster to validate join codes and participant readiness.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
