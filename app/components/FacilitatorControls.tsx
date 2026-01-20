"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { deliverDueInjects } from "@/lib/sessions";

export default function FacilitatorControls({ sessionId }: { sessionId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startExercise() {
    setLoading(true);
    setMsg(null);
    const { error } = await supabase.rpc("start_session", {
      p_session_id: sessionId,
    });
    setLoading(false);

    if (error) {
      setMsg(error.message);
    } else {
      setMsg("Exercise started (T=0)");
    }
  }

  async function deliverScheduled() {
    setLoading(true);
    setMsg(null);
    try {
      const count = await deliverDueInjects(sessionId);
      setMsg(`Delivered ${count} scheduled inject(s)`);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ border: "2px dashed #999", borderRadius: 14, padding: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Facilitator panel</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={startExercise} disabled={loading}>
          ▶ Start exercise
        </button>

        <button onClick={deliverScheduled} disabled={loading}>
          ⏱ Deliver due injects
        </button>
      </div>

      {msg && <div style={{ marginTop: 10, fontSize: 14 }}>{msg}</div>}
    </div>
  );
}
