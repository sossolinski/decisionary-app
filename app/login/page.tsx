"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Po zalogowaniu wracamy na stronę startową (gdzie wybierasz session id),
    // albo możesz tu dać redirect na "ostatnią sesję" w przyszłości.
    router.push("/");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form
        onSubmit={signIn}
        style={{
          width: 360,
          border: "1px solid rgba(0,0,0,0.15)",
          borderRadius: 16,
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>Decisionary</h1>

        <label>
          <div>Email</div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 4 }}
            autoComplete="email"
          />
        </label>

        <label style={{ marginTop: 12, display: "block" }}>
          <div>Password</div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 4 }}
            autoComplete="current-password"
          />
        </label>

        {error && (
          <div style={{ marginTop: 12, color: "crimson", fontSize: 14 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.2)",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.8 : 1,
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
