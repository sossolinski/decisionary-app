"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function JoinPage() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onJoin() {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;

    try {
      setLoading(true);
      setError(null);

      // 1) check session (getUser() throws when missing)
      const { data: sessData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;

      // 2) if no session → anonymous sign-in
      if (!sessData.session) {
        const { data: anonData, error: anonErr } =
          await supabase.auth.signInAnonymously();
        if (anonErr) throw anonErr;
        if (!anonData?.session) {
          throw new Error("Failed to create anonymous session");
        }

        // ensure token is persisted before RPC
        await supabase.auth.getSession();
      }

      // 3) join via RPC
      const { data: sessionId, error: rpcErr } = await supabase.rpc("join_session", {
        p_code: cleaned,
      });

      if (rpcErr) {
        const msg = String(rpcErr.message ?? "");
        if (msg.includes("invalid_join_code")) throw new Error("Invalid join code");
        throw new Error(msg);
      }

      if (!sessionId) throw new Error("Failed to join session");

      router.push(`/sessions/${sessionId}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to join session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
        Join session
      </h1>

      <p style={{ opacity: 0.75, marginBottom: 16 }}>
        Enter the join code provided by the facilitator.
      </p>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="e.g. AB12CD"
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.15)",
          marginBottom: 12,
          fontSize: 16,
          textTransform: "uppercase",
        }}
      />

      <button
        onClick={onJoin}
        disabled={loading || !code.trim()}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.15)",
          fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Joining…" : "Join"}
      </button>

      {error && <div style={{ marginTop: 12, color: "#b91c1c" }}>{error}</div>}
    </div>
  );
}
