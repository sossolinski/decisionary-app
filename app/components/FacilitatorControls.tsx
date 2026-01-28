// app/components/FacilitatorControls.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { deliverDueInjects } from "@/lib/sessions";

import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";

export default function FacilitatorControls({
  sessionId,
  onStarted,
}: {
  sessionId: string;
  onStarted?: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startExercise() {
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.rpc("start_session", { p_session_id: sessionId });

    setLoading(false);

    if (error) setMsg(error.message);
    else {
      setMsg("Exercise started (T=0)");
      onStarted?.();
    }
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
      <CardHeader>
        <CardTitle className="text-sm">Facilitator tools</CardTitle>
        <CardDescription className="text-xs">
          Quick controls for running the exercise and releasing scheduled injects.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" onClick={startExercise} disabled={loading}>
            {loading ? "..." : "Start exercise"}
          </Button>

          <Button variant="secondary" onClick={deliverScheduled} disabled={loading}>
            {loading ? "..." : "Deliver due injects"}
          </Button>
        </div>

        {msg ? (
          <div className="rounded-[var(--radius)] border border-border bg-muted/30 p-2 text-xs font-semibold">
            {msg}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
