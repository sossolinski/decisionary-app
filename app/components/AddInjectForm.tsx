"use client";

import { useState } from "react";
import { sendInjectToSession } from "@/lib/sessions";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";

export default function AddInjectForm({ sessionId }: { sessionId: string }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (sending) return;
    setSending(true);
    setMsg(null);
    try {
      await sendInjectToSession(sessionId, title, body);
      setTitle("");
      setBody("");
      setMsg("Inject sent");
    } catch (e: any) {
      setMsg(e?.message ?? "Failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle>Add inject (facilitator)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="min-h-[120px] w-full rounded-[calc(var(--radius)-6px)] border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:shadow-[var(--studio-ring)]"
          placeholder="Body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <div className="flex items-center gap-3">
          <Button onClick={handleSend} variant="primary" disabled={sending}>
            {sending ? "Sending…" : "Send inject"}
          </Button>
          {msg ? <div className="text-sm text-muted-foreground">{msg}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
