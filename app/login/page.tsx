"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { joinSessionByCode } from "@/lib/sessionsRuntime";

export default function LoginPage() {
  const router = useRouter();

  // Facilitator login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Participant join
  const [joinCode, setJoinCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleFacilitatorLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace("/facilitator");
    } catch (err: any) {
      setMsg(err?.message ?? "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const sessionId = await joinSessionByCode(joinCode); // ✅ zwraca string
      router.replace(`/sessions/${sessionId}`);
    } catch (err: any) {
      setMsg(err?.message ?? "Join failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Decisionary</h1>

      {msg && (
        <div
          style={{
            margin: "12px 0",
            padding: 10,
            borderRadius: 12,
            background: "#fee2e2",
          }}
        >
          {msg}
        </div>
      )}

      <div style={{ display: "grid", gap: 18 }}>
        {/* Facilitator */}
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 14,
            padding: 14,
            background: "white",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Facilitator</h2>

          <form onSubmit={handleFacilitatorLogin} style={{ display: "grid", gap: 10 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.2)",
              }}
            />

            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.2)",
              }}
            />

            <button
              disabled={loading}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.2)",
                background: "white",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 800,
              }}
            >
              {loading ? "…" : "Sign in"}
            </button>
          </form>
        </div>

        {/* Participant */}
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 14,
            padding: 14,
            background: "white",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Participant</h2>

          <form onSubmit={handleJoin} style={{ display: "grid", gap: 10 }}>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="AB12CD"
              autoCapitalize="characters"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.2)",
              }}
            />

            <button
              disabled={loading}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.2)",
                background: "white",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 800,
              }}
            >
              {loading ? "…" : "Join session"}
            </button>
          </form>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            Joining creates an anonymous session (no email required).
          </div>
        </div>
      </div>
    </div>
  );
}
