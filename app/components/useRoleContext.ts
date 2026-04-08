"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { logClientError } from "@/lib/errors";

export type Role = "admin" | "facilitator" | "participant";

export type RoleContext = {
  loading: boolean;
  userId: string | null;
  email: string | null;

  role: Role | null;
  activeRole: Role | null;
  isDisabled: boolean;

  isPermAdmin: boolean;
  canFacilitate: boolean;
};

export function useRoleContext(): RoleContext {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [role, setRole] = useState<Role | null>(null);
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);

  async function load(markLoading = true) {
    if (markLoading) setLoading(true);

    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) logClientError("useRoleContext.auth", authErr);

    const u = auth.user ?? null;
    setUserId(u?.id ?? null);
    setEmail(u?.email ?? null);

    if (!u) {
      setRole(null);
      setActiveRole(null);
      setIsDisabled(false);
      setLoading(false);
      return;
    }

    // ✅ preferred: RPC (security definer)
    const { data: rpcData, error: rpcErr } = await supabase.rpc("get_my_profile");
    if (!rpcErr && rpcData) {
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;

      const r = (row?.role ?? null) as Role | null;
      const ar = ((row?.active_role ?? row?.role) ?? null) as Role | null;

      setRole(r);
      setActiveRole(ar);
      setIsDisabled(!!row?.is_disabled);

      setLoading(false);
      return;
    }

    // fallback: direct select (in case RPC not deployed yet)
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("role, active_role, is_disabled")
      .eq("user_id", u.id)
      .maybeSingle();

    if (profErr) logClientError("useRoleContext.profiles", profErr);

    const r2 = (prof?.role ?? null) as Role | null;
    const ar2 = ((prof?.active_role ?? prof?.role) ?? null) as Role | null;

    setRole(r2);
    setActiveRole(ar2);
    setIsDisabled(!!prof?.is_disabled);

    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void load(false);
    }, 0);
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  const isPermAdmin = role === "admin" && !isDisabled;
  const canFacilitate = (activeRole === "admin" || activeRole === "facilitator") && !isDisabled;

  return { loading, userId, email, role, activeRole, isDisabled, isPermAdmin, canFacilitate };
}
