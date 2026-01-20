"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim()
  );
}

export default function Home() {
  const [id, setId] = useState("");
  const router = useRouter();

  const cleaned = useMemo(() => id.trim(), [id]);
  const valid = useMemo(() => isUuid(cleaned), [cleaned]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          Decisionary MVP
        </h1>
        <p style={{ opacity: 0.75, marginBottom: 14 }}>
          Wklej Session ID (UUID), żeby przejść do ćwiczenia.
        </p>

        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="e.g. 2f8c3c6e-3a6c-4c2d-9f3e-3d9e5a1b2c3d"
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)",
          }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onClick={() => router.push(`/sessions/${cleaned}`)}
            disabled={!valid}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              cursor: valid ? "pointer" : "not-allowed",
              opacity: valid ? 1 : 0.5,
            }}
          >
            Open session
          </button>

          <button
            onClick={() => router.push("/login")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              cursor: "pointer",
              opacity: 0.9,
            }}
          >
            Go to login
          </button>
        </div>

        {!valid && cleaned.length > 0 && (
          <p style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>
            To nie wygląda jak UUID. Skopiuj <code>sessions.id</code> z Supabase.
          </p>
        )}

        <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
          Tip: Session ID znajdziesz w Supabase → tabela <code>sessions</code>.
        </p>
      </div>
    </main>
  );
}
