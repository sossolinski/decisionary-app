// app/components/FacilitatorControls.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { deliverDueInjects } from "@/lib/sessions";

import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";

export default function FacilitatorControls({ sessionId }: { sessionId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startExercise() {
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.rpc("start_session", { p_session_id: sessionId });

    setLoading(false);
    if (error) setMsg(error.message);
    else setMsg("Exercise started (T=0)");
  }

  async function deliverScheduled() {
    setLoading(true);
    setMsg(null);

    try {
      const res = await deliverDueInjects(sessionId);
      setMsg(`Delivered ${res.delivered} scheduled inject(s)`);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="surface shadow-soft border border-[var(--studio-border)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Facilitator tools</CardTitle>
        <CardDescription className="text-sm">
          Quick controls for running the exercise and releasing scheduled injects.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={startExercise} disabled={loading}>
            {loading ? "..." : "Start exercise"}
          </Button>

          <Button variant="secondary" onClick={deliverScheduled} disabled={loading}>
            {loading ? "..." : "Deliver due injects"}
          </Button>
        </div>

        {msg ? (
          <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground">
            {msg}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
