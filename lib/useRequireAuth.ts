// lib/useRequireAuth.ts
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabaseClient";

export function useRequireAuth(opts?: { redirectTo?: string }) {
  const router = useRouter();
  const redirectTo = opts?.redirectTo ?? "/login";
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      const u = data.user;

      if (!u) {
        setLoading(false);
        router.replace(redirectTo);
        return;
      }

      setUserId(u.id);
      setEmail(u.email ?? null);
      setLoading(false);
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const u = session?.user ?? null;
      setUserId(u?.id ?? null);
      setEmail(u?.email ?? null);
      setLoading(false);
      if (!u) router.replace(redirectTo);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router, redirectTo]);

  return { loading, userId, email };
}
