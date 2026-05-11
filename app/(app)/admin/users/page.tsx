"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getErrorMessage, logClientError } from "@/lib/errors";
import useAutoRefresh from "@/app/components/useAutoRefresh";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import HintTooltip from "@/app/components/HintTooltip";
import { ArrowRight, Search, Shield, Sparkles, UserCheck, UserX, Users } from "lucide-react";

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

function makeDisplayName(row: ProfileRow) {
  if (row.full_name?.trim()) return row.full_name.trim();
  if (row.email?.trim()) {
    const local = row.email.split("@")[0] ?? "";
    return local.trim() || row.email;
  }
  return "Unnamed account";
}

function makeSecondaryIdentity(row: ProfileRow) {
  const shortId = row.user_id.slice(0, 8);
  if (row.email?.trim()) return `${row.email} · ID ${shortId}`;
  return `Account ID ${shortId}`;
}

function humanRole(value?: ProfileRow["role"] | ProfileRow["active_role"]) {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function AdminUsersPage() {
  const [meAdmin, setMeAdmin] = useState<boolean>(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ProfileRow[]>([]);

  async function load(withSpinner = true) {
    void withSpinner;
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
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void load(false);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useAutoRefresh(
    async () => {
      await load(false);
    },
    { enabled: meAdmin, intervalMs: 30000 }
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const hay = `${r.email ?? ""} ${r.full_name ?? ""} ${r.role} ${r.active_role ?? ""} ${r.user_id}`.toLowerCase();
      return hay.includes(s);
    });
  }, [rows, q]);

  const enabledCount = useMemo(() => rows.filter((row) => !row.is_disabled).length, [rows]);
  const disabledCount = useMemo(() => rows.filter((row) => row.is_disabled).length, [rows]);
  const adminCount = useMemo(() => rows.filter((row) => row.role === "admin").length, [rows]);

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
      <section className="overflow-hidden rounded-2xl border border-border bg-background px-5 py-5 shadow-[var(--studio-shadow)] md:px-6 md:py-6">
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.95fr] lg:items-start">
          <div className="space-y-4">
            <div className="ui-eyebrow">
              <Sparkles className="h-3.5 w-3.5" />
              People directory
            </div>

            <div className="space-y-2">
              <h1 className="max-w-3xl text-[28px] font-semibold leading-tight tracking-tight text-foreground">
                Manage account access without losing the human context.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-[color:var(--studio-muted)]">
                Review visible accounts, adjust default access, and disable access when an account should stop using the workspace.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Button asChild>
                <Link href="/admin">
                  Admin overview
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/admin/organizations">
                  Organizations
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 self-start sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="ui-metric-label whitespace-nowrap">Accounts</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{rows.length}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)]">
                  <Users className="h-4 w-4" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="ui-metric-label whitespace-nowrap">Enabled</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{enabledCount}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)]">
                  <UserCheck className="h-4 w-4" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="ui-metric-label whitespace-nowrap">Disabled</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{disabledCount}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)]">
                  <UserX className="h-4 w-4" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="ui-metric-label whitespace-nowrap">Admins</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{adminCount}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)]">
                  <Shield className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!meAdmin && (
        <section className="rounded-2xl border border-border bg-background px-5 py-5 shadow-[var(--studio-shadow)]">
          <h2 className="text-lg font-semibold text-foreground">Access denied</h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--studio-muted)]">
            People management is only available to permanent administrators.
          </p>
        </section>
      )}

      {error ? (
        <div className="notice notice-error">{error}</div>
      ) : null}

      {meAdmin && (
        <>
          <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)]">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                Search people
                <HintTooltip text="Filter by name, email, default access level, active role, or account ID." />
              </div>
            </div>
            <div className="space-y-3 px-5 py-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search email, name, access level, account ID…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="text-sm text-[color:var(--studio-muted)]">
                {filtered.length} matching {filtered.length === 1 ? "account" : "accounts"}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)]">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Users className="h-5 w-5 opacity-80" />
                Accounts
                <HintTooltip text="Review visible accounts, then adjust default access level or disable an account when needed." />
              </div>
            </div>
            <div className="space-y-3 px-5 py-5">
              {filtered.length === 0 ? (
                <div className="ui-empty-state">
                  No accounts match the current search.
                </div>
              ) : null}

              {filtered.map((r) => {
                const disabled = r.is_disabled;
                return (
                  <div key={r.user_id} className="flex flex-col gap-4 rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)] transition hover:border-[var(--studio-border-strong)] md:px-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-base font-semibold tracking-tight truncate">
                          {makeDisplayName(r)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground truncate">
                          {makeSecondaryIdentity(r)}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2.5 py-1">
                            Access level: <b>{humanRole(r.role)}</b>
                          </span>
                          <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2.5 py-1">
                            Viewing as: <b>{humanRole(r.active_role)}</b>
                          </span>
                          {disabled ? (
                            <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-destructive">
                              Disabled
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 lg:pt-0.5">
                        <Button
                          variant={disabled ? "secondary" : "destructive"}
                          disabled={busy === r.user_id}
                          onClick={() => setDisabled(r.user_id, !disabled)}
                        >
                          {disabled ? "Enable account" : "Disable account"}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="ui-section-label">Default access level</div>
                      <div className="flex flex-wrap items-center gap-2">
                      {ROLE_OPTIONS.map((roleOpt) => (
                        <Button
                          key={roleOpt}
                          variant={r.role === roleOpt ? "default" : "secondary"}
                          disabled={busy === r.user_id}
                          onClick={() => setRole(r.user_id, roleOpt)}
                        >
                          <Shield className="h-4 w-4" />
                          Set as {humanRole(roleOpt)}
                        </Button>
                      ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
