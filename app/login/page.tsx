"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { joinSessionByCode } from "@/lib/sessionsRuntime";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card } from "@/app/components/ui/card";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const sessionId = await joinSessionByCode(joinCode);
      router.replace(`/sessions/${sessionId}`);
    } catch (err: any) {
      setMsg(err?.message ?? "Join failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <div className="text-2xl font-bold tracking-tight">Decisionary</div>
          <div className="text-sm text-muted-foreground">
            Tabletop simulation platform
          </div>
        </div>

        {msg && (
          <div className="rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-sm">
            {msg}
          </div>
        )}

        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold">Facilitator</div>
          <form onSubmit={handleFacilitatorLogin} className="space-y-2">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
            />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {loading ? "…" : "Sign in"}
            </Button>
          </form>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="text-sm font-semibold">Participant</div>
          <form onSubmit={handleJoin} className="space-y-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="AB12CD"
              autoCapitalize="characters"
            />
            <Button type="submit" variant="secondary" disabled={loading} className="w-full">
              {loading ? "…" : "Join session"}
            </Button>
          </form>

          <div className="text-xs text-muted-foreground">
            Joining creates an anonymous session (no email required).
          </div>
        </Card>
      </div>
    </main>
  );
}
