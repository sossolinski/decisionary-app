// app/(app)/join/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

export default function JoinPage() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onJoin() {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;

    try {
      setLoading(true);
      setError(null);

      // 1) check session (getUser() throws when missing)
      const { data: sessData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;

      // 2) if no session → anonymous sign-in
      if (!sessData.session) {
        const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously();
        if (anonErr) throw anonErr;
        if (!anonData?.session) {
          throw new Error("Failed to create anonymous session");
        }

        // ensure token is persisted before RPC
        await supabase.auth.getSession();
      }

      // 3) join via RPC
      const { data: sessionId, error: rpcErr } = await supabase.rpc("join_session", {
        p_code: cleaned,
      });

      if (rpcErr) {
        const msg = String(rpcErr.message ?? "");
        if (msg.includes("invalid_join_code")) throw new Error("Invalid join code");
        throw new Error(msg);
      }

      if (!sessionId) throw new Error("Failed to join session");

      router.push(`/sessions/${sessionId}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to join session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[520px]">
      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Join session</CardTitle>
          <CardDescription className="text-sm">
            Enter the join code provided by the facilitator.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold">Join code</div>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB12CD"
              className="uppercase"
            />
          </div>

          <Button
            variant="primary"
            onClick={onJoin}
            disabled={loading || !code.trim()}
            className="w-full"
          >
            {loading ? "Joining…" : "Join"}
          </Button>

          {error ? (
            <div className="rounded-[var(--radius)] border border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.06)] px-4 py-3 text-sm font-semibold text-[hsl(var(--destructive))]">
              {error}
            </div>
          ) : null}

          <div className="text-xs text-muted-foreground">Tip: codes are not case-sensitive.</div>
        </CardContent>
      </Card>
    </div>
  );
}
