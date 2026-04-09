"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import { joinSessionByCode } from "@/lib/sessionsRuntime";
import { getErrorMessage } from "@/lib/errors";
import { validateJoinCode } from "@/lib/validators";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import HintTooltip from "@/app/components/HintTooltip";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";

type Role = "admin" | "facilitator" | "participant";

function Hero() {
  return (
    <div className="space-y-4 text-center">
      <div className="inline-flex items-center rounded-full border border-[color:var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-1 text-xs font-semibold text-[color:var(--studio-muted)] shadow-soft">
        Decisionary
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Sign in or join a live exercise.
        </h1>
        <p className="mx-auto max-w-[54ch] text-sm leading-7 text-[color:var(--studio-muted)] sm:text-base">
          Use your organization account to run sessions, manage scenarios, and coordinate the exercise. Participants can join instantly with a short code.
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      const { data: profileData, error: profileError } = await supabase.rpc("get_my_profile");
      if (profileError) throw profileError;

      const profile = Array.isArray(profileData) ? profileData[0] : profileData;
      const nextRole = (profile?.active_role ?? profile?.role ?? null) as Role | null;

      if (nextRole === "admin") {
        router.replace("/admin/organizations");
        return;
      }
      if (nextRole === "facilitator") {
        router.replace("/facilitator");
        return;
      }

      router.replace("/participant");
    } catch (e: unknown) {
      setAuthError(getErrorMessage(e, "Sign in failed."));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleCreateAccount() {
    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      setAuthMessage(
        "Account created. You can sign in now. Facilitator or admin access is added separately by your organization."
      );
    } catch (e: unknown) {
      setAuthError(getErrorMessage(e, "Account creation failed."));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const validCode = validateJoinCode(joinCode);
    if (!validCode.ok) {
      setJoinError(validCode.error);
      return;
    }

    setJoinLoading(true);
    setJoinError(null);

    try {
      const sessionId = await joinSessionByCode(validCode.value);
      router.replace(`/sessions/${sessionId}`);
    } catch (e: unknown) {
      setJoinError(getErrorMessage(e, "Join failed."));
    } finally {
      setJoinLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10 sm:py-16">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl items-center justify-center">
        <div className="w-full">
          <section className="mx-auto flex w-full max-w-3xl flex-col items-center space-y-8">
            <Hero />

            <div className="grid w-full gap-4 sm:grid-cols-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>Sign in</span>
                    <HintTooltip text="Use this if you already have a Decisionary account. Facilitator and admin access is assigned by your organization." />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <form onSubmit={handleSignIn} className="space-y-3">
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Work email"
                      autoComplete="email"
                    />
                    <Input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      placeholder="Your password"
                      autoComplete="current-password"
                    />

                    {authError ? (
                      <div className="rounded-[14px] border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {authError}
                      </div>
                    ) : null}

                    {authMessage ? (
                      <div className="rounded-[14px] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                        {authMessage}
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Button type="submit" className="w-full" disabled={authLoading || joinLoading}>
                        {authLoading ? "Signing in..." : "Sign in"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={authLoading || joinLoading || !email.trim() || !password.trim()}
                        onClick={handleCreateAccount}
                      >
                        Create account
                      </Button>
                    </div>
                  </form>

                  <p className="text-sm leading-6 text-[color:var(--studio-muted2)]">
                    New here? Create a participant account first. Facilitator and admin access is granted separately by your organization.
                  </p>
                </CardContent>
              </Card>

              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>Join session</span>
                    <HintTooltip text="Use the 6-character code shared by your facilitator to enter a live exercise without creating an account." />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <form onSubmit={handleJoin} className="space-y-3">
                    <Input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="Session code"
                      autoCapitalize="characters"
                    />

                    {joinError ? (
                      <div className="rounded-[14px] border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {joinError}
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-[color:var(--studio-muted2)]">
                        Enter the 6-character code shared by your facilitator. No account is required.
                      </p>
                    )}

                    <Button
                      type="submit"
                      variant="secondary"
                      className="w-full"
                      disabled={joinLoading || authLoading}
                    >
                      {joinLoading ? "Joining..." : "Join with code"}
                    </Button>
                  </form>

                  <p className="text-sm leading-6 text-[color:var(--studio-muted2)]">
                    If you were invited as a facilitator, use the registration link from your email instead of this form.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
