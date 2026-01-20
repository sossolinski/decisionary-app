"use client";

import { useState } from "react";
import { sendInjectToSession } from "@/lib/sessions";

export default function AddInjectForm({ sessionId }: { sessionId: string }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSend() {
    try {
      await sendInjectToSession(sessionId, title, body);
      setTitle("");
      setBody("");
      setMsg("Inject sent");
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  return (
    <div style={{ border: "1px dashed #ccc", padding: 16 }}>
      <h3>Add inject (facilitator)</h3>

      <input
        placeholder="Inject title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />

      <textarea
        placeholder="Inject message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        style={{ width: "100%", marginBottom: 8 }}
      />

      <button onClick={handleSend}>Send inject</button>

      {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
