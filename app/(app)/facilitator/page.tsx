"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/users";
import { LogOut, PlayCircle, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function FacilitatorHome() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const role = await getMyRole();
      if (!role) {
        router.replace("/login");
        return;
      }
      if (role !== "facilitator") {
        router.replace("/participant");
      }
    })().catch((e) => setMsg(e?.message ?? String(e)));
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facilitator Panel</h1>
          <p className="text-sm text-muted-foreground">
            Start sessions, manage scenarios and keep your exercises organized.
          </p>
        </div>

        <Button variant="outline" className="w-full md:w-auto rounded-2xl" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </div>

      {msg && (
        <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {msg}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10">
                <PlayCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">Sessions</CardTitle>
                <CardDescription>
                  Start, restart and open existing sessions.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full rounded-2xl"
              onClick={() => router.push("/facilitator/sessions")}
            >
              Open Sessions
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">Scenarios</CardTitle>
                <CardDescription>
                  Create and edit scenarios, injects and initial situation.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full rounded-2xl"
              onClick={() => router.push("/facilitator/scenarios")}
            >
              Open Scenarios
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 text-xs text-muted-foreground">
        Tip: add tags and severity levels to injects to make facilitation faster.
      </div>
    </div>
  );
}
