// app/(app)/facilitator/sessions/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useRoleContext } from "@/app/components/useRoleContext";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { ExternalLink, Loader2 } from "lucide-react";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function errMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

export default function FacilitatorSessionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { loading, canFacilitate } = useRoleContext();
  const id = params?.id ?? "";
  const valid = useMemo(() => isUuid(id), [id]);

  const [status, setStatus] = useState<"checking" | "redirecting" | "error">("checking");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setErr(null);
        setStatus("checking");

        if (!valid) {
          setStatus("error");
          setErr("Invalid session id (expected UUID).");
          return;
        }

        if (cancelled) return;
        if (loading || !canFacilitate) {
          return;
        }

        setStatus("redirecting");
        router.replace(`/sessions/${id}`);
      } catch (e: unknown) {
        if (cancelled) return;
        setStatus("error");
        setErr(errMessage(e, "Failed to open session."));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, id, valid, loading, canFacilitate]);

  return (
    <div className="mx-auto w-full max-w-[var(--studio-max)] space-y-6">
      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {status === "redirecting" || status === "checking" ? (
              <Loader2 className="h-4 w-4 animate-spin opacity-80" />
            ) : (
              <ExternalLink className="h-4 w-4 opacity-80" />
            )}
            Opening session
          </CardTitle>

          <CardDescription className="text-sm">
            {status === "error"
              ? "We couldn't redirect automatically."
              : "Redirecting you to the live room…"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {err ? (
            <div className="notice notice-error">
              {err}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              If nothing happens, use the button.
            </div>

            <Button
              variant="secondary"
              onClick={() => router.replace(`/sessions/${id}`)}
              disabled={!valid}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
