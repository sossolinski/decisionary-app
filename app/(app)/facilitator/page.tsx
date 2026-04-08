"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getMyRole } from "@/lib/users";
import { listScenarios, listSessions } from "@/lib/sessionsRuntime";
import { useRoleContext } from "@/app/components/useRoleContext";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { ArrowRight, BookOpen, ClipboardList, PlayCircle, Sparkles } from "lucide-react";

export default function FacilitatorHomePage() {
  const router = useRouter();
  const { activeOrg } = useRoleContext();
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    (async () => {
      const role = await getMyRole();
      if (!role) {
        router.replace("/login");
        return;
      }
      if (role !== "facilitator" && role !== "admin") {
        router.replace("/participant");
        return;
      }
      await loadCounts();
      setLoading(false);
    })();
  }, [router]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--card)/0.94))]">
        <CardContent className="relative pt-6">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-56 rounded-bl-[32px] bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_62%)]" />
          <div className="relative grid gap-5 lg:grid-cols-[1.35fr_0.85fr] lg:items-start">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--studio-border)] bg-background/80 px-3 py-1 text-xs font-semibold text-[color:var(--studio-muted)]">
                <Sparkles className="h-3.5 w-3.5" />
                Facilitator workspace
              </div>

              <div className="space-y-2">
                <h1 className="text-[28px] font-semibold tracking-tight">Run realistic exercises with less friction.</h1>
                <p className="max-w-[60ch] text-sm leading-7 text-[color:var(--studio-muted)]">
                  Build scenarios, launch sessions, and coordinate the exercise flow from one calm control surface.
                </p>
                <div className="text-sm text-[color:var(--studio-muted)]">
                  Active organization: <b className="text-foreground">{activeOrg?.name ?? "not selected"}</b>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button asChild>
                  <Link href="/facilitator/sessions">
                    Go to Sessions
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>

                <Button asChild variant="secondary">
                  <Link href="/facilitator/scenarios">Manage Scenarios</Link>
                </Button>

                <Button
                  variant="outline"
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

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="surface2 rounded-[16px] px-4 py-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)]">
                      Scenarios
                    </div>
                    <div className="mt-2 text-3xl font-semibold">{loading ? "—" : scenarioCount}</div>
                  </div>
                  <div className="rounded-[12px] border border-[color:var(--studio-border)] bg-background/80 p-2">
                    <BookOpen className="h-4 w-4 text-foreground/80" />
                  </div>
                </div>
              </div>

              <div className="surface2 rounded-[16px] px-4 py-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)]">
                      Sessions
                    </div>
                    <div className="mt-2 text-3xl font-semibold">{loading ? "—" : sessionCount}</div>
                  </div>
                  <div className="rounded-[12px] border border-[color:var(--studio-border)] bg-background/80 p-2">
                    <PlayCircle className="h-4 w-4 text-foreground/80" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <div className="notice notice-error mt-5">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>1. Prepare</CardTitle>
              <div className="rounded-[12px] border border-[color:var(--studio-border)] bg-background/80 p-2">
                <BookOpen className="h-4 w-4 text-foreground/80" />
              </div>
            </div>
            <CardDescription>
              Build scenarios and inject libraries for realistic runs.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <span className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              Create and iterate on content.
            </span>
            <Button asChild variant="secondary" size="sm">
              <Link href="/facilitator/scenarios">Scenarios</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>2. Run</CardTitle>
              <div className="rounded-[12px] border border-[color:var(--studio-border)] bg-background/80 p-2">
                <PlayCircle className="h-4 w-4 text-foreground/80" />
              </div>
            </div>
            <CardDescription>
              Start a session, invite participants, deliver injects.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <span className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              Lifecycle control & tools.
            </span>
            <Button asChild variant="secondary" size="sm">
              <Link href="/facilitator/sessions">Sessions</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>3. Review</CardTitle>
              <div className="rounded-[12px] border border-[color:var(--studio-border)] bg-background/80 p-2">
                <ClipboardList className="h-4 w-4 text-foreground/80" />
              </div>
            </div>
            <CardDescription>
              Capture actions, decisions, and key timeline points.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">
            (Next) Add After-Action Report & exports.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
