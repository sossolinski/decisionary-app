"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { getMyRole } from "../../lib/users";

export default function ParticipantHome() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const role = await getMyRole();
      if (!role) {
        router.replace("/login");
        return;
      }
      if (role !== "participant") {
        router.replace("/facilitator");
      }
    })().catch((e) => setMsg(e?.message ?? String(e)));
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Participant</h1>
        <button onClick={logout} style={{ padding: "8px 12px" }}>
          Log out
        </button>
      </div>

      {msg && <p style={{ marginTop: 10, color: "#b91c1c" }}>{msg}</p>}

      <div style={{ marginTop: 18, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 12, padding: 14 }}>
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Join a session</h2>
        <p style={{ opacity: 0.8, marginBottom: 10 }}>
          Open a session link provided by the facilitator.
        </p>
        <button
          onClick={() => router.push("/sessions")}
          style={{ padding: "9px 12px" }}
        >
          Open Sessions List (temp)
        </button>
      </div>
    </div>
  );
}
