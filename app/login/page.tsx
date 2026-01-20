"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      // Minimalny, pewny redirect po zalogowaniu:
      router.replace("/participant");
    } catch (err: any) {
      setMsg(err?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <form
        onSubmit={signIn}
        style={{
          width: "min(420px, 100%)",
          background: "rgba(255,255,255,0.9)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 16,
          padding: 18,
          boxShadow: "0 18px 40px rgba(11,18,32,0.10)",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Decisionary</div>
        <div style={{ opacity: 0.75, marginBottom: 14 }}>Sign in to continue</div>

        <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          required
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            marginBottom: 12,
          }}
        />

        <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          required
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            marginBottom: 12,
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            fontWeight: 800,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        {msg ? (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(239,68,68,0.35)",
              background: "rgba(239,68,68,0.06)",
              color: "#991b1b",
              fontWeight: 600,
            }}
          >
            {msg}
          </div>
        ) : null}

        <div style={{ marginTop: 14, fontSize: 13, opacity: 0.75 }}>
          After login you’ll be redirected to <b>/participant</b>. If you’re a facilitator, open{" "}
          <b>/facilitator</b>.
        </div>
      </form>
    </div>
  );
}
