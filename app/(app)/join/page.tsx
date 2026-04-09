// app/(app)/join/page.tsx
"use client";

import { useState } from "react";
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

export default function JoinPage() {
  const router = useRouter();

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
      setError(getErrorMessage(e, "Join failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Join session</span>
              <HintTooltip text="Enter the session code provided by your facilitator to open the exercise." />
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <Input
              placeholder="Join code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onJoin();
              }}
            />

            {error ? (
              <div className="rounded-[14px] border border-[var(--studio-border)] bg-destructive/10 px-4 py-3 text-sm">
                {error}
              </div>
            ) : null}

            <Button
              className="w-full"
              onClick={onJoin}
              disabled={loading}
            >
              {loading ? "Joining…" : "Join"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
