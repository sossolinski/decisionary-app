// app/components/FacilitatorControls.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { deliverDueInjects } from "@/lib/sessions";
import { setSessionStatus } from "@/lib/sessionsRuntime";

import HintTooltip from "@/app/components/HintTooltip";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";

function errMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

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

      // Fallback: if RPC not available, at least set status=live + started_at
      const em = String(error?.message ?? "");
      const low = em.toLowerCase();

      if (low.includes("does not exist") || low.includes("function")) {
        // 1) set status via helper (already used in your codebase)
        await setSessionStatus(sessionId, "live");

        // 2) best-effort: also set started_at if column exists + RLS allows
        try {
          await supabase
            .from("sessions")
            .update({ started_at: new Date().toISOString() })
            .eq("id", sessionId);
        } catch {
          // ignore
        }

        setMsg(
          "Exercise started (fallback: status set to LIVE). Tip: add start_session RPC to set started_at server-side."
        );
        onStarted?.();
        return;
      }

      setMsg(em || "Failed to start");
    } catch (e: unknown) {
      setMsg(errMessage(e, "Failed to start"));
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
    } catch (e: unknown) {
      setMsg(errMessage(e, "Failed"));
    } finally {
      setDelivering(false);
    }
  }

  return (
    <div className="hidden lg:block">
      <Card className="w-[360px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Facilitator tools</span>
            <HintTooltip text="Use these quick controls to start the exercise and release any injects scheduled for delivery." />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Button onClick={startExercise} disabled={starting}>
            {starting ? "Starting..." : "Start exercise"}
          </Button>
          <Button
            variant="secondary"
            onClick={deliverScheduled}
            disabled={delivering}
          >
            {delivering ? "Delivering..." : "Deliver due injects"}
          </Button>

          {msg ? (
            <div className="ml-2 text-xs font-bold text-muted-foreground">
              {msg}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
