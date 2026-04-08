"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import { logClientError } from "@/lib/errors";
import {
  ensureAdminBootstrap,
  getActiveOrgId,
  listOrganizationsForUser,
  setActiveOrgId as persistActiveOrgId,
  type Organization,
} from "@/lib/organizationsMvp";

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

  organizations: Organization[];
  activeOrgId: string | null;
  activeOrg: Organization | null;
  setActiveOrgId: (orgId: string | null) => void;
  reloadOrganizations: () => void;
};

function useRoleContextValue(): RoleContext {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [role, setRole] = useState<Role | null>(null);
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);

  function syncOrganizations(uid: string | null, em: string | null, r: Role | null) {
    if (!uid) {
      setOrganizations([]);
      setActiveOrgIdState(null);
      return;
    }

    if (r === "admin") {
      ensureAdminBootstrap({ userId: uid, email: em });
    }

    const orgs = listOrganizationsForUser({ userId: uid, email: em, role: r });
    setOrganizations(orgs);

    const saved = getActiveOrgId({ userId: uid, email: em });
    const validSaved = saved && orgs.some((org) => org.id === saved) ? saved : null;
    const next = validSaved ?? (orgs[0]?.id ?? null);

    setActiveOrgIdState(next);

    if (next) {
      persistActiveOrgId({ userId: uid, email: em, orgId: next });
    } else {
      persistActiveOrgId({ userId: uid, email: em, orgId: null });
    }
  }

  const load = useCallback(async (markLoading = true) => {
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
      setOrganizations([]);
      setActiveOrgIdState(null);
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
      syncOrganizations(u.id, u.email ?? null, r);

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
    syncOrganizations(u.id, u.email ?? null, r2);

    setLoading(false);
  }, []);

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
  }, [load]);

  const isPermAdmin = role === "admin" && !isDisabled;
  const canFacilitate = (activeRole === "admin" || activeRole === "facilitator") && !isDisabled;
  const activeOrg =
    activeOrgId && organizations.some((org) => org.id === activeOrgId)
      ? organizations.find((org) => org.id === activeOrgId) ?? null
      : null;

  function setActiveOrgId(orgId: string | null) {
    setActiveOrgIdState(orgId);
    persistActiveOrgId({ userId, email, orgId });
  }

  function reloadOrganizations() {
    syncOrganizations(userId, email, role);
  }

  return {
    loading,
    userId,
    email,
    role,
    activeRole,
    isDisabled,
    isPermAdmin,
    canFacilitate,
    organizations,
    activeOrgId,
    activeOrg,
    setActiveOrgId,
    reloadOrganizations,
  };
}

const RoleContextState = createContext<RoleContext | null>(null);

export function RoleContextProvider({ children }: { children: ReactNode }) {
  const value = useRoleContextValue();
  return createElement(RoleContextState.Provider, { value }, children);
}

export function useRoleContext(): RoleContext {
  const ctx = useContext(RoleContextState);
  if (!ctx) {
    throw new Error("useRoleContext must be used within RoleContextProvider");
  }
  return ctx;
}
