"use client";

import { useRequireAuth } from "@/lib/useRequireAuth";

export default function ParticipantPage() {
  const { loading, userId, email } = useRequireAuth();

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!userId) return <div>Not authenticated</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Participant</h1>
      <div style={{ marginTop: 8, opacity: 0.8 }}>
        Signed in as: {email ?? `Anonymous (${userId.slice(0, 8)})`}
      </div>
    </div>
  );
}
