"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, BellRing, Sparkles, Users } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";
import { listAllOrganizationsForAdmin, listNotificationAnnouncements, type Organization } from "@/lib/organizations";
import { getErrorMessage, logClientError } from "@/lib/errors";

type DashboardState = {
  allOrganizations: Organization[];
  accounts: number;
  announcements: number;
};

export default function AdminOverviewPage() {
  const { loading, isPermAdmin } = useRoleContext();
  const [state, setState] = useState<DashboardState>({
    allOrganizations: [],
    accounts: 0,
    announcements: 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);

    try {
      const [orgs, accountsResult, announcements] = await Promise.all([
        listAllOrganizationsForAdmin(),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        listNotificationAnnouncements(null),
      ]);

      if (accountsResult.error) {
        throw accountsResult.error;
      }

      setState({
        allOrganizations: orgs,
        accounts: accountsResult.count ?? 0,
        announcements: announcements.length,
      });
    } catch (err: unknown) {
      logClientError("AdminOverviewPage.load", err);
      setError(getErrorMessage(err, "Failed to load the admin overview."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!isPermAdmin) return;
    void load();
  }, [isPermAdmin]);

  useAutoRefresh(
    async () => {
      await load();
    },
    { enabled: isPermAdmin, intervalMs: 30000 }
  );

  const activeOrganizations = useMemo(
    () => state.allOrganizations.filter((org) => !org.archived),
    [state.allOrganizations]
  );
  const archivedOrganizations = useMemo(
    () => state.allOrganizations.filter((org) => org.archived),
    [state.allOrganizations]
  );

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (!isPermAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>This page is available only to workspace admins.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
        <div className="relative px-5 py-5 md:px-6 md:py-6">
          <div className="pointer-events-none absolute right-0 top-0 h-28 w-52 rounded-bl-[28px] bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_62%)]" />
          <div className="relative grid gap-5 lg:grid-cols-[1.3fr_0.9fr] lg:items-start">
            <div className="space-y-4">
              <div className="ui-eyebrow">
                <Sparkles className="h-3.5 w-3.5" />
                Superadmin workspace
              </div>

              <div className="space-y-2">
                <h1 className="text-[28px] font-semibold tracking-tight">Oversee the whole workspace from one place.</h1>
                <p className="max-w-[62ch] text-sm leading-7 text-[color:var(--studio-muted)]">
                  Keep track of organizations, people, and announcements without jumping between separate admin islands.
                </p>
              </div>

            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="ui-metric-card">
                <div className="ui-metric-label">Active orgs</div>
                <div className="mt-2 text-3xl font-semibold">{activeOrganizations.length}</div>
              </div>
              <div className="ui-metric-card">
                <div className="ui-metric-label">Archived orgs</div>
                <div className="mt-2 text-3xl font-semibold">{archivedOrganizations.length}</div>
              </div>
              <div className="ui-metric-card">
                <div className="ui-metric-label">Accounts</div>
                <div className="mt-2 text-3xl font-semibold">{state.accounts}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="notice notice-error">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 opacity-80" />
              Organizations
            </CardTitle>
            <CardDescription>Review active and archived organizations, then manage one in detail.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-[color:var(--studio-muted)]">
              <div>{activeOrganizations.length} active</div>
              <div>{archivedOrganizations.length} archived</div>
            </div>
            <Button asChild className="w-full">
              <Link href="/admin/organizations">Open organization management</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 opacity-80" />
              People
            </CardTitle>
            <CardDescription>Review workspace accounts, access levels, and disabled users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[color:var(--studio-muted)]">{state.accounts} visible accounts</div>
            <Button asChild className="w-full" variant="secondary">
              <Link href="/admin/users">Open people directory</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 opacity-80" />
              Announcements
            </CardTitle>
            <CardDescription>Manage workspace notices from the organization workspace when you need shared communication.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[color:var(--studio-muted)]">{state.announcements} active global notices</div>
            <Button asChild className="w-full" variant="secondary">
              <Link href="/admin/announcements">Open announcements</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
