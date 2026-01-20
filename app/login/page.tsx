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
      const sess = await joinSessionByCode(joinCode);
      router.replace(`/sessions/${sess.id}`);
    } catch (err: any) {
      setMsg(err?.message ?? "Join failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>Decisionary</h1>

      {msg && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.12)",
          }}
        >
          {msg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Facilitator */}
        <form
          onSubmit={handleFacilitatorLogin}
          style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.12)",
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Facilitator</h2>

          <label style={{ display: "block", marginBottom: 6 }}>Email</label>
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

          <label style={{ display: "block", marginTop: 12, marginBottom: 6 }}>Password</label>
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
            type="submit"
            disabled={loading}
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.2)",
              cursor: "pointer",
              width: "100%",
            }}
          >
            {loading ? "…" : "Sign in"}
          </button>
        </form>

        {/* Participant */}
        <form
          onSubmit={handleJoin}
          style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.12)",
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Participant</h2>

          <label style={{ display: "block", marginBottom: 6 }}>Join code</label>
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
            type="submit"
            disabled={loading}
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.2)",
              cursor: "pointer",
              width: "100%",
            }}
          >
            {loading ? "…" : "Join session"}
          </button>

          <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>
            Joining creates an anonymous session (no email required).
          </div>
        </form>
      </div>
    </div>
  );
}
