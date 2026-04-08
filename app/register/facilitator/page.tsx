"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { acceptFacilitatorInvite, getFacilitatorInviteByToken } from "@/lib/organizations";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";

function toMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function FacilitatorRegistrationInner() {
  const search = useSearchParams();
  const router = useRouter();

  const token = (search.get("token") ?? "").trim();

  const [invite, setInvite] = useState<Awaited<ReturnType<typeof getFacilitatorInviteByToken>>>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setInvite(null);
      return;
    }

    void getFacilitatorInviteByToken(token)
      .then((row) => {
        setInvite(row);
        setEmail(row?.email ?? "");
      })
      .catch((e: unknown) => {
        setErr(toMessage(e, "Failed to load invite."));
      });
  }, [token]);

  async function onAccept() {
    if (!invite) {
      setErr("Invalid invite token.");
      return;
    }

    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const { data: auth } = await supabase.auth.getUser();
      let userId = auth.user?.id ?? null;

      if (!userId) {
        if (!email.trim() || !password.trim()) {
          throw new Error("Email and password are required.");
        }

        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signUpErr) throw signUpErr;

        userId = signUpData.user?.id ?? null;
      }

      await acceptFacilitatorInvite(token);

      setMsg(
        "Invite accepted. If your profile role is not facilitator yet, admin should set it in Admin -> Users."
      );

      window.setTimeout(() => {
        router.replace("/login");
      }, 700);
    } catch (e: unknown) {
      setErr(toMessage(e, "Failed to accept invite."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <div className="text-2xl font-bold tracking-tight">Facilitator registration</div>
          <div className="text-sm text-muted-foreground">
            {invite ? `Organization: ${invite.org_name}` : "Invitation required"}
          </div>
        </div>

        <Card className="p-4 space-y-3">
          {!token ? (
            <div className="text-sm text-destructive">Missing invite token in URL.</div>
          ) : null}

          {invite ? (
            <div className="text-sm">
              <div>
                Invited email: <b>{invite.email}</b>
              </div>
              <div className="text-xs text-muted-foreground">
                status: {invite.status} · expires {new Date(invite.expires_at).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="text-sm text-destructive">Invite not found.</div>
          )}

          {msg ? (
            <div className="rounded-[var(--radius)] border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              {msg}
            </div>
          ) : null}

          {err ? (
            <div className="rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          ) : null}

          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            autoComplete="email"
          />
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Set password"
            autoComplete="new-password"
            type="password"
          />

          <Button onClick={onAccept} disabled={loading || !invite} className="w-full">
            {loading ? "…" : "Accept invite"}
          </Button>

          <Button asChild variant="secondary" className="w-full">
            <Link href="/login">Back to login</Link>
          </Button>
        </Card>
      </div>
    </main>
  );
}

export default function FacilitatorRegistrationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen grid place-items-center p-6">
          <div className="text-sm text-muted-foreground">Loading invite…</div>
        </main>
      }
    >
      <FacilitatorRegistrationInner />
    </Suspense>
  );
}
