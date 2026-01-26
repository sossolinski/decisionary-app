// app/components/FacilitatorControls.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { deliverDueInjects } from "@/lib/sessions";

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
    <div style={{ padding: 12, borderRadius: 14, border: "1px solid rgba(0,0,0,0.12)" }}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>Facilitator panel</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={startExercise}
          disabled={loading}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.16)",
            background: "white",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 800,
          }}
        >
          ▶ Start exercise
        </button>

        <button
          onClick={deliverScheduled}
          disabled={loading}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.16)",
            background: "white",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 800,
          }}
        >
          ⏱ Deliver due injects
        </button>
      </div>

      {msg && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.04)" }}>
          {msg}
        </div>
      )}
    </div>
  );
}
