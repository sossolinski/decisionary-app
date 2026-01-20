"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function useRequireAuth(options?: {
  redirectTo?: string; // default: "/login"
}) {
  const router = useRouter();
  const pathname = usePathname();
  const redirectTo = options?.redirectTo ?? "/login";

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);

      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;

        const u = data.user;

        if (!u) {
          // Nie redirectuj, jeśli już jesteś na /login (bez pętli)
          if (pathname !== redirectTo) router.replace(redirectTo);
          if (mounted) {
            setUserId(null);
            setUserEmail(null);
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          setUserId(u.id);
          setUserEmail(u.email ?? null);
          setLoading(false);
        }
      } catch {
        // Przy błędzie zachowaj się jak "brak sesji"
        if (pathname !== redirectTo) router.replace(redirectTo);
        if (mounted) {
          setUserId(null);
          setUserEmail(null);
          setLoading(false);
        }
      }
    }

    run();

    // Bonus: reaguj na logout/login w innych tabach
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        if (pathname !== redirectTo) router.replace(redirectTo);
        if (mounted) {
          setUserId(null);
          setUserEmail(null);
          setLoading(false);
        }
      } else {
        if (mounted) {
          setUserId(session.user.id);
          setUserEmail(session.user.email ?? null);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, pathname, redirectTo]);

  return { loading, userId, userEmail };
}
