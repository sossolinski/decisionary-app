"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { joinSessionByCode } from "@/lib/sessionsRuntime";
import { getErrorMessage } from "@/lib/errors";
import { validateJoinCode } from "@/lib/validators";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

type Role = "admin" | "facilitator" | "participant";

async function resolveSignedInRole(): Promise<Role | null> {
  const { data: profileData, error: profileError } = await supabase.rpc("get_my_profile");
  if (profileError) throw profileError;

  const profileRow = Array.isArray(profileData) ? (profileData[0] ?? null) : profileData;
  if (profileRow) {
    return (profileRow.active_role ?? profileRow.role ?? null) as Role | null;
  }

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  if (!userId) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, active_role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return ((profile?.active_role ?? profile?.role) ?? null) as Role | null;
}

function joinErrorMessage(error: unknown) {
  const message = getErrorMessage(error, "Join failed.");
  if (message === "Not authenticated" || message === "Guest join is unavailable right now.") {
    return "Guest join is unavailable right now. Try again in a moment or use a participant account.";
  }
  return message;
}

function signInErrorMessage(error: unknown) {
  const message = getErrorMessage(error, "Sign in failed.");
  if (message.toLowerCase().includes("email or phone")) {
    return "Enter your work email and password.";
  }
  return message;
}

function Hero() {
  const headerButtonClass = "inline-flex min-h-9 items-center justify-center rounded-[8px] border border-[#c5cedd] px-3 text-sm font-semibold text-[#5a6578] transition hover:border-[#2457d6] hover:text-[#111827]";

  return (
    <section className="flex items-center justify-between gap-4 border-b border-[#dce2ec] px-5 py-5 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-3 font-semibold text-[#111827]">
        <span className="grid h-9 w-9 place-items-center rounded-[8px] border border-[#111827] text-sm font-bold">D</span>
        <span>Decisionary</span>
      </Link>
      <Link href="/" className={headerButtonClass}>
        Back to site
      </Link>
    </section>
  );
}

export default function AuthHome() {
  const router = useRouter();
  const pathname = usePathname();
  const signInEmailId = useId();
  const signInPasswordId = useId();
  const joinCodeId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const labelClass = "mb-2 block text-sm font-semibold leading-6 text-[#111827]";
  const inputClass = "h-11 rounded-[8px] border-[#c5cedd] bg-white text-[#111827] shadow-none placeholder:text-[#7a8598] hover:border-[#9aa7bc]";
  const outlineButtonClass = "min-h-11 rounded-[8px] border-[#111827] bg-white text-[#111827] shadow-none hover:bg-[#f5f7fb]";

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const workEmail = email.trim();

    if (!workEmail) {
      setAuthError("Enter your work email.");
      return;
    }
    if (!password) {
      setAuthError("Enter your password.");
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: workEmail,
        password,
      });
      if (error) throw error;

      const nextRole = await resolveSignedInRole();

      if (nextRole === "admin") {
        router.replace("/admin");
        return;
      }
      if (nextRole === "facilitator") {
        router.replace("/facilitator");
        return;
      }

      router.replace("/participant");
    } catch (e: unknown) {
      setAuthError(signInErrorMessage(e));
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
      setJoinError(joinErrorMessage(e));
    } finally {
      setJoinLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef2f8] px-5 py-8 text-[#111827] sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[900px] items-center justify-center">
        <section className="w-full overflow-hidden rounded-[8px] border border-[#dce2ec] bg-white shadow-[0_24px_70px_rgba(23,35,63,0.12)]">
        <Hero />

          <div className="px-5 py-7 sm:px-6">
            <div className="max-w-[620px]">
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#12a68c]">Access</p>
              <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[0]">Sign in or join a session.</h1>
              <p className="mt-2 text-sm leading-6 text-[#5a6578]">
                Use your organization account, or enter the session code shared by your facilitator.
              </p>
            </div>

            <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_0.86fr]">
              <div>
                <h2 className="text-base font-semibold">Organization account</h2>
                <form onSubmit={handleSignIn} className="mt-4 space-y-4">
                  <div>
                    <label htmlFor={signInEmailId} className={labelClass}>Work email</label>
                    <Input
                      id={signInEmailId}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      placeholder="name@company.com"
                      autoComplete="email"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor={signInPasswordId} className={labelClass}>Password</label>
                    <Input
                      id={signInPasswordId}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      placeholder="Your password"
                      autoComplete="current-password"
                      className={inputClass}
                    />
                  </div>

                  {authError ? (
                    <div role="alert" aria-live="assertive" className="rounded-[8px] border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {authError}
                    </div>
                  ) : null}

                  <div>
                    <Button type="submit" className="min-h-11 w-full rounded-[8px]" disabled={authLoading || joinLoading}>
                      {authLoading ? "Signing in..." : "Sign in"}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </form>

                <p className="mt-4 rounded-[8px] border border-[#dce2ec] bg-[#f5f7fb] px-4 py-3 text-sm leading-6 text-[#5a6578]">
                  Accounts are provisioned by your organization. Participants can join with a session code.
                </p>
              </div>

              <div className="border-t border-[#dce2ec] pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <h2 className="text-base font-semibold">Session code</h2>
                <form onSubmit={handleJoin} className="mt-4 space-y-4">
                  <div>
                    <label htmlFor={joinCodeId} className={labelClass}>Code</label>
                  <Input
                    id={joinCodeId}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="ABC123"
                    autoCapitalize="characters"
                    className={inputClass}
                  />
                </div>

                {joinError ? (
                  <div role="alert" aria-live="assertive" className="rounded-[8px] border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {joinError}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-[#5a6578]">
                    You can join as a guest participant.
                  </p>
                )}

                <Button
                  type="submit"
                  className={outlineButtonClass}
                  disabled={joinLoading || authLoading}
                >
                  {joinLoading ? "Joining..." : "Join with code"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>

              <p className="mt-4 text-sm leading-6 text-[#5a6578]">
                {pathname === "/login"
                  ? "If you were invited as a facilitator, use the registration link from your email instead of this form."
                  : "Facilitator access is granted separately through an invitation link from your organization. Guest join is only for participants."}
              </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
