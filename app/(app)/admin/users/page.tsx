"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getErrorMessage, logClientError } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Shield, Sparkles, Search, Users } from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ProfileRow[]>([]);

  async function load(withSpinner = true) {
    if (withSpinner) setLoading(true);
    setError(null);

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

      if (error) {
        logClientError("AdminUsersPage.load.listProfiles", error);
        setError(getErrorMessage(error, "Failed to load users."));
      }
      setRows((data ?? []) as ProfileRow[]);
    } else {
      setRows([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void load(false);
    }, 0);
    return () => clearTimeout(t);
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
    if (error) {
      logClientError("AdminUsersPage.setRole", error);
      setError(getErrorMessage(error, "Failed to change role."));
    }
    await load();
    setBusy(null);
  }

  async function setDisabled(userId: string, disabled: boolean) {
    setBusy(userId);
    const { error } = await supabase.rpc("admin_set_user_disabled", { p_user_id: userId, p_disabled: disabled });
    if (error) {
      logClientError("AdminUsersPage.setDisabled", error);
      setError(getErrorMessage(error, "Failed to update disabled flag."));
    }
    await load();
    setBusy(null);
  }

  return (
    <div className="space-y-5">
      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
        <div className="relative px-5 py-5 md:px-6 md:py-6">
          <div className="pointer-events-none absolute right-0 top-0 h-28 w-52 rounded-bl-[28px] bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_62%)]" />
          <div className="relative grid gap-5 lg:grid-cols-[1.3fr_0.9fr] lg:items-start">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--studio-border)] bg-background/80 px-3 py-1 text-xs font-semibold text-[color:var(--studio-muted)]">
                <Sparkles className="h-3.5 w-3.5" />
                Admin workspace
              </div>

              <div className="space-y-2">
                <h1 className="text-[28px] font-semibold tracking-tight">Manage account access without losing the people context.</h1>
                <p className="max-w-[62ch] text-sm leading-7 text-[color:var(--studio-muted)]">
                  Review platform users, update permanent access levels, and disable accounts when needed.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void load()} disabled={loading} variant="outline">
                  Refresh
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="surface2 rounded-[16px] px-4 py-4 shadow-soft">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)]">Accounts</div>
                <div className="mt-2 text-3xl font-semibold">{rows.length}</div>
              </div>
              <div className="surface2 rounded-[16px] px-4 py-4 shadow-soft">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--studio-muted2)]">Visible</div>
                <div className="mt-2 text-3xl font-semibold">{filtered.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!meAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>You must be a permanent admin (profiles.role = admin).</CardDescription>
          </CardHeader>
        </Card>
      )}

      {error ? (
        <div className="notice notice-error">{error}</div>
      ) : null}

      {meAdmin && (
        <>
          <Card>
            <CardContent className="pt-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search email, name, role, uuid…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 opacity-80" />
                Accounts
              </CardTitle>
              <CardDescription>{loading ? "Loading…" : `${filtered.length} users`}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {filtered.map((r) => {
                const disabled = r.is_disabled;
                return (
                  <div
                    key={r.user_id}
                    className="flex flex-col gap-3 rounded-[16px] border border-[var(--studio-border)] bg-[var(--studio-surface)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold tracking-tight truncate">
                          {r.full_name ?? r.email ?? r.user_id}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {r.email ?? "—"} · {r.user_id}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2.5 py-1">
                            role: <b>{r.role}</b>
                          </span>
                          <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2.5 py-1">
                            active: <b>{r.active_role ?? "—"}</b>
                          </span>
                          {disabled ? (
                            <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-destructive">
                              disabled
                            </span>
                          ) : null}
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
                          <Shield className="h-4 w-4" />
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
