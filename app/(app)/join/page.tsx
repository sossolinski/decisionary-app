// app/(app)/join/page.tsx
"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { joinSessionByCode } from "@/lib/sessionsRuntime";
import { getErrorMessage } from "@/lib/errors";
import { validateJoinCode } from "@/lib/validators";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import HintTooltip from "@/app/components/HintTooltip";

function joinErrorMessage(error: unknown) {
  const message = getErrorMessage(error, "Join failed");
  if (message === "Not authenticated" || message === "Guest join is unavailable right now.") {
    return "Guest join is unavailable right now. Try again in a moment or use a participant account.";
  }
  return message;
}

export default function JoinPage() {
  const router = useRouter();
  const joinCodeId = useId();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onJoin() {
    const validCode = validateJoinCode(code);
    if (!validCode.ok) {
      setError(validCode.error);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sessionId = await joinSessionByCode(validCode.value);
      router.push(`/sessions/${sessionId}`);
    } catch (e: unknown) {
      setError(joinErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-8 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl items-center justify-center">
        <section className="flex w-full max-w-[780px] flex-col items-center space-y-6">
          <div className="space-y-3 text-center">
            <div className="ui-eyebrow shadow-soft">Join a live session</div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
                Enter your session code.
              </h1>
              <p className="mx-auto max-w-[46ch] text-sm leading-7 text-[color:var(--studio-muted)] sm:text-base">
                Use the short code shared by your facilitator to open the exercise right away. If needed, Decisionary will create a guest session for you.
              </p>
            </div>
          </div>

          <div className="w-full max-w-md">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>Join session</span>
                  <HintTooltip text="Enter the session code provided by your facilitator to open the exercise." />
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <label htmlFor={joinCodeId} className="ui-form-label">Join code</label>
                  <Input
                    id={joinCodeId}
                    placeholder="Join code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onJoin();
                    }}
                  />
                </div>

                {error ? (
                  <div role="alert" aria-live="assertive" className="notice notice-error">{error}</div>
                ) : (
                  <p className="text-sm leading-6 text-[color:var(--studio-muted2)]">
                    The code is usually 6 characters long. You can join with your account or as a guest participant.
                  </p>
                )}

                <Button
                  className="w-full"
                  onClick={onJoin}
                  disabled={loading}
                >
                  {loading ? "Joining…" : "Join session"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
