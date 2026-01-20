"use client";

import { useRequireAuth } from "@/lib/useRequireAuth";

export default function ParticipantPage() {
  const { loading, userEmail } = useRequireAuth();

  if (loading) {
    return (
      <div style={{ padding: 24, opacity: 0.8 }}>
        Loading…
      </div>
    );
  }

  // Jeśli brak usera, hook zrobi redirect do /login.
  // Renderujemy fallback, żeby nie było “białej” w międzyczasie.
  if (!userEmail) return null;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: 0, marginBottom: 10 }}>Participant</h1>
      <div style={{ opacity: 0.75 }}>Signed in as: {userEmail}</div>

      {/* TODO: tu Twoja istniejąca zawartość participant */}
    </div>
  );
}
