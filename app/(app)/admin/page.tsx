"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BellRing, Building2, CreditCard, Sparkles, Users } from "lucide-react";

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
  pendingOrders: number;
};

export default function AdminOverviewPage() {
  const { loading, isPermAdmin } = useRoleContext();
  const [state, setState] = useState<DashboardState>({
    allOrganizations: [],
    accounts: 0,
    announcements: 0,
    pendingOrders: 0,
  });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);

    try {
      const [orgs, accountsResult, announcements, pendingOrdersResult] = await Promise.all([
        listAllOrganizationsForAdmin(),
        supabase.from("profiles").select("user_id", { count: "exact", head: true }),
        listNotificationAnnouncements(null),
        supabase.from("billing_orders").select("id", { count: "exact", head: true }).eq("status", "payment_pending"),
      ]);

      if (accountsResult.error) {
        throw accountsResult.error;
      }

      if (pendingOrdersResult.error) {
        throw pendingOrdersResult.error;
      }

      setState({
        allOrganizations: orgs,
        accounts: accountsResult.count ?? 0,
        announcements: announcements.length,
        pendingOrders: pendingOrdersResult.count ?? 0,
      });
    } catch (err: unknown) {
      logClientError("AdminOverviewPage.load", err);
      setError(getErrorMessage(err, "Failed to load the admin overview."));
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
      <section className="rounded-2xl border border-border bg-background px-5 py-5 shadow-[var(--studio-shadow)]">
        <h1 className="text-lg font-semibold text-foreground">Access denied</h1>
        <p className="mt-1 text-sm leading-6 text-[color:var(--studio-muted)]">
          This workspace is only available to permanent administrators.
        </p>
      </section>
    );
  }

  const adminModules = [
    {
      title: "Organizations",
      eyebrow: "Workspace structure",
      description: "Review active and archived organizations, membership, participant accounts, and organization notices.",
      metric: `${activeOrganizations.length} active`,
      secondaryMetric: `${archivedOrganizations.length} archived`,
      href: "/admin/organizations",
      action: "Open organizations",
      icon: Building2,
      accent: "bg-blue-500/65",
      pill: "border-blue-500/20 bg-blue-500/10 text-blue-800 dark:text-blue-300",
    },
    {
      title: "People",
      eyebrow: "Accounts",
      description: "Review user accounts, roles, active role state, and disabled access across the platform.",
      metric: `${state.accounts} accounts`,
      secondaryMetric: "Directory",
      href: "/admin/users",
      action: "Open people",
      icon: Users,
      accent: "bg-emerald-500/65",
      pill: "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    },
    {
      title: "Billing",
      eyebrow: "Orders",
      description: "Create orders, open invoice flows, and grant live exercise entitlements when needed.",
      metric: `${state.pendingOrders} pending`,
      secondaryMetric: "Stripe flow",
      href: "/admin/billing",
      action: "Open billing",
      icon: CreditCard,
      accent: "bg-violet-500/65",
      pill: "border-violet-500/20 bg-violet-500/10 text-violet-800 dark:text-violet-300",
    },
    {
      title: "Announcements",
      eyebrow: "Platform notices",
      description: "Publish and manage shared notices for operators, facilitators, and participants.",
      metric: `${state.announcements} active`,
      secondaryMetric: "Notices",
      href: "/admin/announcements",
      action: "Open notices",
      icon: BellRing,
      accent: "bg-amber-500/65",
      pill: "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-background px-5 py-5 shadow-[var(--studio-shadow)] md:px-6 md:py-6">
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.95fr] lg:items-start">
          <div className="space-y-4">
            <div className="ui-eyebrow">
              <Sparkles className="h-3.5 w-3.5" />
              Admin workspace
            </div>

            <div className="space-y-2">
              <h1 className="max-w-3xl text-[28px] font-semibold leading-tight tracking-tight text-foreground">
                Keep the platform organized and ready.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-[color:var(--studio-muted)]">
                Manage organizations, people, billing access, and shared notices from one operational overview.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Button asChild>
                <Link href="/admin/organizations">
                  Manage organizations
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="secondary">
                <Link href="/admin/users">People directory</Link>
              </Button>

              <Button asChild variant="outline">
                <Link href="/admin/billing">Billing</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 self-start sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="ui-metric-label whitespace-nowrap">Orgs</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{activeOrganizations.length}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)]">
                  <Building2 className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="ui-metric-label whitespace-nowrap">Accounts</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{state.accounts}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)]">
                  <Users className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background px-4 py-4 shadow-[0_8px_20px_hsl(220_20%_20%/0.025)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="ui-metric-label whitespace-nowrap">Orders</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{state.pendingOrders}</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)]">
                  <CreditCard className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="notice notice-error">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {adminModules.map((module) => {
          const Icon = module.icon;

          return (
            <section key={module.title} className="group flex h-full min-h-[250px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--studio-shadow)] transition hover:border-[var(--studio-border-strong)]">
              <div className={["h-1", module.accent].join(" ")} />
              <div className="flex flex-1 flex-col px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={["inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]", module.pill].join(" ")}>
                      {module.eyebrow}
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-foreground">{module.title}</h2>
                    <p className="mt-2 max-w-[34ch] text-sm leading-6 text-[color:var(--studio-muted)]">
                      {module.description}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-[color:var(--studio-muted)] transition group-hover:border-primary/25 group-hover:text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  <div className="mb-4 flex flex-wrap gap-2 text-[11px] text-[color:var(--studio-muted2)]">
                    <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2 py-0.5">
                      {module.metric}
                    </span>
                    <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2 py-0.5">
                      {module.secondaryMetric}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                    <span className="text-xs font-semibold text-[color:var(--studio-muted2)]">{module.eyebrow}</span>
                    <Button asChild variant="secondary" size="sm" className="shrink-0 gap-1.5">
                      <Link href={module.href}>
                        {module.action}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
