"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { joinSessionByCode } from "@/lib/sessionsRuntime";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card } from "@/app/components/ui/card";

type Role = "admin" | "facilitator" | "participant";

type DebugState = {
  loading: boolean;
  signedIn: boolean;
  userId: string | null;
  email: string | null;

  profileFound: boolean;
  role: Role | null;
  activeRole: Role | null;
  isDisabled: boolean | null;

  lastError: string | null;
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function errMessage(e: unknown, fallback = "Unknown error") {
  return e instanceof Error ? e.message : fallback;
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [dbg, setDbg] = useState<DebugState>({
    loading: true,
    signedIn: false,
    userId: null,
    email: null,
    profileFound: false,
    role: null,
    activeRole: null,
    isDisabled: null,
    lastError: null,
  });

  const badge = useMemo(() => {
    if (dbg.loading) return "Loading…";
    if (!dbg.signedIn) return "Signed out";
    const p = dbg.profileFound ? "Profile OK" : "Profile MISSING";
    return `${p} · perm=${dbg.role ?? "—"} · view=${dbg.activeRole ?? "—"}${
      dbg.isDisabled ? " · DISABLED" : ""
    }`;
  }, [dbg]);

  async function refreshDebug() {
    setDbg((s) => ({ ...s, loading: true, lastError: null }));

    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const u = auth.user ?? null;

      if (!u) {
        setDbg({
          loading: false,
          signedIn: false,
          userId: null,
          email: null,
          profileFound: false,
          role: null,
          activeRole: null,
          isDisabled: null,
          lastError: null,
        });
        return;
      }

      // ✅ preferred: RPC
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_my_profile");

      if (rpcErr) {
        setDbg({
          loading: false,
          signedIn: true,
          userId: u.id,
          email: u.email ?? null,
          profileFound: false,
          role: null,
          activeRole: null,
          isDisabled: null,
          lastError: rpcErr.message ?? String(rpcErr),
        });
        return;
      }

      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;

      const role = (row?.role ?? null) as Role | null;
      const activeRole = ((row?.active_role ?? row?.role) ?? null) as Role | null;
      const isDisabled = (row?.is_disabled ?? null) as boolean | null;

      setDbg({
        loading: false,
        signedIn: true,
        userId: u.id,
        email: u.email ?? null,
        profileFound: !!row,
        role,
        activeRole,
        isDisabled,
        lastError: null,
      });
    } catch (e: unknown) {
      setDbg((s) => ({
        ...s,
        loading: false,
        lastError: errMessage(e),
      }));
    }
  }

  useEffect(() => {
    void refreshDebug();

    const { data: sub } = supabase.auth.onAuthStateChange(() => void refreshDebug());
    return () => sub.subscription.unsubscribe();
  }, []);

  async function waitForSession(maxMs = 2500) {
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      const { data } = await supabase.auth.getSession();
      if (data.session) return true;
      await sleep(120);
    }
    return false;
  }

  async function handleFacilitatorLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const ok = await waitForSession();
      await refreshDebug();

      if (!ok) {
        setMsg("Signed in, but session not ready yet. Click Refresh status and try again.");
        return;
      }

      router.replace("/facilitator");
    } catch (err: unknown) {
      setMsg(errMessage(err, "Login failed."));
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
    } catch (err: unknown) {
      setMsg(errMessage(err, "Join failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <div className="text-2xl font-bold tracking-tight">Decisionary</div>
          <div className="text-sm text-muted-foreground">Tabletop simulation platform</div>
        </div>

        {msg && (
          <div className="rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-sm">
            {msg}
          </div>
        )}

        <Card className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Auth & Profile status</div>
              <div className="text-xs text-muted-foreground break-words">{badge}</div>

              {dbg.lastError ? (
                <div className="mt-2 text-xs text-red-500 break-words">
                  Error: {dbg.lastError}
                </div>
              ) : null}

              {dbg.userId ? (
                <div className="mt-1 text-[11px] text-muted-foreground break-words">
                  user_id: {dbg.userId}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={dbg.loading}
                onClick={refreshDebug}
              >
                {dbg.loading ? "…" : "Refresh"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  await supabase.auth.signOut();
                  await refreshDebug();
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </Card>

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
            <Button type="submit" variant="default" disabled={loading} className="w-full">
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
