"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

type ProfileRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "facilitator" | "participant";
  active_role: "admin" | "facilitator" | "participant" | null;
  is_disabled: boolean;
  created_at: string;
  updated_at: string;
  disabled_at: string | null;
};

const ROLE_OPTIONS: Array<ProfileRow["role"]> = ["participant", "facilitator", "admin"];

export default function AdminUsersPage() {
  const [meAdmin, setMeAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ProfileRow[]>([]);

  async function load() {
    setLoading(true);

    // 1) check if I'm permanent admin
    const { data: me } = await supabase
      .from("profiles")
      .select("role,is_disabled")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .maybeSingle();

    const isAdmin = me?.role === "admin" && me?.is_disabled === false;
    setMeAdmin(!!isAdmin);

    // 2) fetch profiles (admin only)
    if (isAdmin) {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,email,full_name,role,active_role,is_disabled,created_at,updated_at,disabled_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) console.error(error);
      setRows((data ?? []) as ProfileRow[]);
    } else {
      setRows([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const hay = `${r.email ?? ""} ${r.full_name ?? ""} ${r.role} ${r.active_role ?? ""} ${r.user_id}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, q]);

  async function setRole(userId: string, role: ProfileRow["role"]) {
    setBusy(userId);
    const { error } = await supabase.rpc("admin_set_user_role", { p_user_id: userId, p_role: role });
    if (error) console.error(error);
    await load();
    setBusy(null);
  }

  async function setDisabled(userId: string, disabled: boolean) {
    setBusy(userId);
    const { error } = await supabase.rpc("admin_set_user_disabled", { p_user_id: userId, p_disabled: disabled });
    if (error) console.error(error);
    await load();
    setBusy(null);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Admin · Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage facilitators/participants. (Auth user creation is done via Invite/Edge Function; here you manage DB roles & access.)
          </p>
        </div>
        <Button onClick={load} disabled={loading}>Refresh</Button>
      </div>

      {!meAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>You must be a permanent admin (profiles.role = admin).</CardDescription>
          </CardHeader>
        </Card>
      )}

      {meAdmin && (
        <>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search email, name, role, uuid…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Accounts</CardTitle>
              <CardDescription>{loading ? "Loading…" : `${filtered.length} users`}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {filtered.map((r) => {
                const disabled = r.is_disabled;
                return (
                  <div
                    key={r.user_id}
                    className="flex flex-col gap-2 rounded-md border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {r.full_name ?? r.email ?? r.user_id}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {r.email ?? "—"} · {r.user_id}
                        </div>
                        <div className="text-xs mt-1">
                          <span className="mr-2">role: <b>{r.role}</b></span>
                          <span>active: <b>{r.active_role ?? "—"}</b></span>
                          {disabled && <span className="ml-2 text-destructive">disabled</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant={disabled ? "secondary" : "destructive"}
                          disabled={busy === r.user_id}
                          onClick={() => setDisabled(r.user_id, !disabled)}
                        >
                          {disabled ? "Enable" : "Disable"}
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {ROLE_OPTIONS.map((roleOpt) => (
                        <Button
                          key={roleOpt}
                          variant={r.role === roleOpt ? "default" : "secondary"}
                          disabled={busy === r.user_id}
                          onClick={() => setRole(r.user_id, roleOpt)}
                        >
                          Set {roleOpt}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
