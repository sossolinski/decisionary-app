// app/components/FacilitatorControls.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { deliverDueInjects } from "@/lib/sessions";
import { setSessionStatus } from "@/lib/sessionsRuntime";

import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";

export default function FacilitatorControls({
  sessionId,
  onStarted,
}: {
  sessionId: string;
  onStarted?: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [delivering, setDelivering] = useState(false);

  async function startExercise() {
    if (!sessionId || starting) return;

    setStarting(true);
    setMsg(null);

    try {
      // Primary path: RPC (preferred)
      const { error } = await supabase.rpc("start_session", {
        p_session_id: sessionId,
      });

      if (!error) {
        setMsg("Exercise started (T=0)");
        onStarted?.();
        return;
      }

      // Fallback path: if RPC not available, at least set status=live
      const em = String(error?.message ?? "");
      const low = em.toLowerCase();

      if (low.includes("does not exist") || low.includes("function")) {
        await setSessionStatus(sessionId, "live");
        setMsg(
          "Exercise started (fallback: status set to LIVE). Tip: add start_session RPC to set started_at server-side."
        );
        onStarted?.();
        return;
      }

      setMsg(em || "Failed to start");
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to start");
    } finally {
      setStarting(false);
    }
  }

  async function deliverScheduled() {
    if (!sessionId || delivering) return;

    setDelivering(true);
    setMsg(null);

    try {
      const res = await deliverDueInjects(sessionId);
      setMsg(`Delivered ${res.delivered} scheduled inject(s)`);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed");
    } finally {
      setDelivering(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facilitator tools</CardTitle>
        <CardDescription>
          Quick controls for running the exercise and releasing scheduled injects.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={startExercise} disabled={!sessionId || starting}>
            {starting ? "Starting..." : "Start exercise"}
          </Button>

          <Button
            onClick={deliverScheduled}
            disabled={!sessionId || delivering}
            variant="secondary"
          >
            {delivering ? "Delivering..." : "Deliver due injects"}
          </Button>
        </div>

        {msg ? (
          <div className="rounded-[var(--radius)] border border-border bg-muted/40 px-3 py-2 text-sm">
            {msg}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
