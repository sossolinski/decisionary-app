// app/(app)/facilitator/sessions/[id]/page.tsx
"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getMyRole } from "@/lib/users";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";

export default function FacilitatorSessionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  useEffect(() => {
    (async () => {
      const role = await getMyRole();
      if (!role) return router.replace("/login");
      if (role !== "facilitator") return router.replace("/participant");
      router.replace(`/sessions/${id}`);
    })();
  }, [router, id]);

  return (
    <div className="mx-auto w-full max-w-[var(--studio-max)] p-6 space-y-6">
      <Card className="surface shadow-soft border border-[var(--studio-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Opening session</CardTitle>
          <CardDescription className="text-sm">
            Redirecting you to the live room…
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">If nothing happens, use the button.</div>
          <Button variant="secondary" onClick={() => router.replace(`/sessions/${id}`)}>
            Open now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
