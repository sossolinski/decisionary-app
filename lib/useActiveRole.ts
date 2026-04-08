"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export type Role = "admin" | "facilitator" | "participant";

type State = {
  loading: boolean;
  signedIn: boolean;
  role: Role | null;        // perm
  activeRole: Role | null;  // view
};

export function useActiveRole() {
  const [state, setState] = useState<State>({
    loading: true,
    signedIn: false,
    role: null,
    activeRole: null,
  });

  async function load(markLoading = true) {
    if (markLoading) {
      setState((s) => ({ ...s, loading: true }));
    }

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;

    if (!user) {
      setState({
        loading: false,
        signedIn: false,
        role: null,
        activeRole: null,
      });
      return;
    }

    const { data, error } = await supabase.rpc("get_my_profile");

    const row = Array.isArray(data) ? data[0] : data;

    if (error || !row) {
      setState({
        loading: false,
        signedIn: true,
        role: null,
        activeRole: null,
      });
      return;
    }

    setState({
      loading: false,
      signedIn: true,
      role: row.role ?? null,
      activeRole: row.active_role ?? row.role ?? null,
    });
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

  return state;
}
