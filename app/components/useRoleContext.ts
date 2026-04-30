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
  getMyActiveOrgId,
  listOrganizationsForCurrentUser,
  setMyActiveOrgId,
  type Organization,
} from "@/lib/organizations";

export type Role = "admin" | "facilitator" | "participant";

export type RoleContext = {
  loading: boolean;
  userId: string | null;
  email: string | null;
  isAnonymous: boolean;
  emailConfirmedAt: string | null;
  needsEmailConfirmation: boolean;

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
  refresh: () => Promise<void>;
};

function useRoleContextValue(): RoleContext {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [emailConfirmedAt, setEmailConfirmedAt] = useState<string | null>(null);

  const [role, setRole] = useState<Role | null>(null);
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);

  async function syncOrganizations(uid: string | null) {
    if (!uid) {
      setOrganizations([]);
      setActiveOrgIdState(null);
      return;
    }

    let orgs: Organization[] = [];

    try {
      orgs = await listOrganizationsForCurrentUser();
      setOrganizations(orgs);
    } catch (err: unknown) {
      logClientError("useRoleContext.syncOrganizations.list", err);
      setOrganizations([]);
      setActiveOrgIdState(null);
      return;
    }

    try {
      const saved = await getMyActiveOrgId(uid);
      const validSaved = saved && orgs.some((org) => org.id === saved) ? saved : null;
      setActiveOrgIdState(validSaved ?? (orgs[0]?.id ?? null));
    } catch (err: unknown) {
      logClientError("useRoleContext.syncOrganizations.activeOrg", err);
      setActiveOrgIdState(orgs[0]?.id ?? null);
    }
  }

  const load = useCallback(async (markLoading = true) => {
    if (markLoading) setLoading(true);

    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) logClientError("useRoleContext.auth", authErr);

      const u = auth.user ?? null;
      setUserId(u?.id ?? null);
      setEmail(u?.email ?? null);
      setIsAnonymous(!!u?.is_anonymous);
      setEmailConfirmedAt(u?.email_confirmed_at ?? null);

      if (!u) {
        setRole(null);
        setActiveRole(null);
        setIsDisabled(false);
        setIsAnonymous(false);
        setEmailConfirmedAt(null);
        setOrganizations([]);
        setActiveOrgIdState(null);
        setLoading(false);
        return;
      }

      // preferred: RPC (security definer)
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_my_profile");
      const rpcRow = Array.isArray(rpcData) ? (rpcData[0] ?? null) : rpcData;
      if (!rpcErr && rpcRow) {
        const row = rpcRow;

        const r = (row?.role ?? null) as Role | null;
        const ar = ((row?.active_role ?? row?.role) ?? null) as Role | null;

        setRole(r);
        setActiveRole(ar);
        setIsDisabled(!!row?.is_disabled);
        await syncOrganizations(u.id);

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
      await syncOrganizations(u.id);
    } catch (err: unknown) {
      logClientError("useRoleContext.load", err);
      setOrganizations([]);
      setActiveOrgIdState(null);
    } finally {
      setLoading(false);
    }
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
  const needsEmailConfirmation = !isAnonymous && !!email && !emailConfirmedAt;
  const activeOrg =
    activeOrgId && organizations.some((org) => org.id === activeOrgId)
      ? organizations.find((org) => org.id === activeOrgId) ?? null
      : null;

  function setActiveOrgId(orgId: string | null) {
    setActiveOrgIdState(orgId);
    void setMyActiveOrgId(orgId).catch((err) => {
      logClientError("useRoleContext.setActiveOrgId", err);
      void load(false);
    });
  }

  function reloadOrganizations() {
    void syncOrganizations(userId).catch((err) => {
      logClientError("useRoleContext.reloadOrganizations", err);
    });
  }

  return {
    loading,
    userId,
    email,
    isAnonymous,
    emailConfirmedAt,
    needsEmailConfirmation,
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
    refresh: () => load(false),
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
