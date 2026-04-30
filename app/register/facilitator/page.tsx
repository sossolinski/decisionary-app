"use client";

import { Suspense, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { acceptFacilitatorInvite, getFacilitatorInviteByToken } from "@/lib/organizations";
import { Button } from "@/app/components/ui/button";
import HintTooltip from "@/app/components/HintTooltip";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
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
  const emailId = useId();
  const passwordId = useId();

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
    <main className="min-h-screen px-6 py-10 sm:py-16">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl items-center justify-center">
        <div className="w-full max-w-3xl">
          <div className="space-y-8 text-center">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full border border-[color:var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-1 text-xs font-semibold text-[color:var(--studio-muted)] shadow-soft">
                Facilitator invite
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Activate your facilitator access.
                </h1>
                <p className="mx-auto max-w-[54ch] text-sm leading-7 text-[color:var(--studio-muted)] sm:text-base">
                  Accept the invitation from your organization, set a password if needed, and continue into Decisionary.
                </p>
              </div>
            </div>

            <Card className="mx-auto w-full max-w-xl text-left">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>{invite ? invite.org_name : "Invitation required"}</span>
                  <HintTooltip
                    text={
                      invite
                        ? "This invite links your account to the organization below and grants facilitator access after acceptance."
                        : "Open this page from a valid invitation link to continue."
                    }
                  />
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {!token ? (
                  <div role="alert" aria-live="assertive" className="rounded-[14px] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Missing invite token in the URL.
                  </div>
                ) : null}

                {invite ? (
                  <div className="ui-subtle-panel text-sm">
                    <div>
                      Invited email: <b>{invite.email}</b>
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--studio-muted2)]">
                      Status: {invite.status} · Expires {new Date(invite.expires_at).toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div role="alert" aria-live="assertive" className="rounded-[14px] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Invite not found.
                  </div>
                )}

                {msg ? <div role="status" aria-live="polite" className="notice notice-success">{msg}</div> : null}

                {err ? (
                  <div role="alert" aria-live="assertive" className="rounded-[14px] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {err}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div>
                    <label htmlFor={emailId} className="ui-form-label">Work email</label>
                    <Input
                      id={emailId}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Work email"
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label htmlFor={passwordId} className="ui-form-label">Create your password</label>
                    <Input
                      id={passwordId}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create your password"
                      autoComplete="new-password"
                      type="password"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Button onClick={onAccept} disabled={loading || !invite} className="w-full">
                    {loading ? "Accepting invite..." : "Accept invite"}
                  </Button>

                  <Button asChild variant="secondary" className="w-full">
                    <Link href="/login">Back to sign in</Link>
                  </Button>
                </div>

                <p className="text-sm leading-6 text-[color:var(--studio-muted2)]">
                  If you already have a Decisionary account, sign in with the invited email first, then return to this invitation link.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function FacilitatorRegistrationPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen grid place-items-center p-6">
          <div className="text-sm text-muted-foreground">Loading invitation…</div>
        </main>
      }
    >
      <FacilitatorRegistrationInner />
    </Suspense>
  );
}
