"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SelectHTMLAttributes } from "react";
import { CreditCard, ExternalLink, Receipt, ShieldCheck, Sparkles } from "lucide-react";

import { useRoleContext } from "@/app/components/useRoleContext";
import useAutoRefresh from "@/app/components/useAutoRefresh";
import {
  createBillingOrder,
  createStripeInvoiceForOrder,
  getBillingInfraMessage,
  getOrgBillingAccount,
  listBillingEntitlements,
  listBillingOrderItems,
  listBillingOrders,
  manualGrantBillingEntitlement,
  upsertOrgBillingAccount,
  type BillingEntitlement,
  type BillingItemType,
  type BillingOrder,
  type BillingOrderItem,
  type BillingScenarioSource,
  type BillingAccount,
} from "@/lib/billing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { getErrorMessage } from "@/lib/errors";

type NoticeTone = "ok" | "err";

type OrderPreset = {
  key: string;
  label: string;
  itemType: BillingItemType;
  title: string;
  scenarioSource: BillingScenarioSource | null;
  participantLimit: number | null;
};

const ORDER_PRESETS: OrderPreset[] = [
  {
    key: "live-own-5",
    label: "Live exercise · own scenario · up to 5",
    itemType: "live_exercise",
    title: "Live exercise · own scenario · up to 5 participants",
    scenarioSource: "own_scenario",
    participantLimit: 5,
  },
  {
    key: "live-own-10",
    label: "Live exercise · own scenario · up to 10",
    itemType: "live_exercise",
    title: "Live exercise · own scenario · up to 10 participants",
    scenarioSource: "own_scenario",
    participantLimit: 10,
  },
  {
    key: "live-own-15",
    label: "Live exercise · own scenario · up to 15",
    itemType: "live_exercise",
    title: "Live exercise · own scenario · up to 15 participants",
    scenarioSource: "own_scenario",
    participantLimit: 15,
  },
  {
    key: "template-access",
    label: "Scenario template access",
    itemType: "scenario_template",
    title: "Scenario template access",
    scenarioSource: "template",
    participantLimit: null,
  },
  {
    key: "custom-service",
    label: "Custom scenario service",
    itemType: "custom_scenario_service",
    title: "Custom scenario service",
    scenarioSource: "custom_service",
    participantLimit: null,
  },
];

function toneClass(tone: NoticeTone) {
  return tone === "ok" ? "notice notice-success" : "notice notice-error";
}

function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={[
        "h-10 w-full rounded-[var(--radius)] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 text-sm",
        props.className ?? "",
      ].join(" ")}
    />
  );
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    maximumFractionDigits: 2,
  }).format((amount ?? 0) / 100);
}

export default function AdminBillingPage() {
  const { loading, isPermAdmin, activeOrg, activeOrgId } = useRoleContext();

  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [billingAccount, setBillingAccount] = useState<BillingAccount | null>(null);
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [orderItemsById, setOrderItemsById] = useState<Record<string, BillingOrderItem[]>>({});
  const [entitlements, setEntitlements] = useState<BillingEntitlement[]>([]);

  const [billingEmail, setBillingEmail] = useState("");
  const billingEmailDirtyRef = useRef(false);
  const billingEmailOrgIdRef = useRef<string | null>(null);
  const [presetKey, setPresetKey] = useState(ORDER_PRESETS[0].key);
  const [quantity, setQuantity] = useState("1");
  const [unitAmount, setUnitAmount] = useState("150000");
  const [notes, setNotes] = useState("");

  const [grantType, setGrantType] = useState<BillingItemType>("live_exercise");
  const [grantTitle, setGrantTitle] = useState("Manual live exercise access");
  const [grantLimit, setGrantLimit] = useState("5");
  const [grantQuantity, setGrantQuantity] = useState("1");

  const activeEntitlements = useMemo(
    () => entitlements.filter((item) => item.status === "active" || item.status === "consumed"),
    [entitlements]
  );

  const pendingOrders = useMemo(
    () => orders.filter((item) => item.status === "payment_pending"),
    [orders]
  );
  const visibleOrders = useMemo(() => orders.slice(0, 8), [orders]);

  const load = useCallback(async () => {
    if (!activeOrgId) {
      setBillingAccount(null);
      setOrders([]);
      setEntitlements([]);
      setOrderItemsById({});
      setBillingEmail("");
      billingEmailOrgIdRef.current = null;
      billingEmailDirtyRef.current = false;
      return;
    }

    const [accountResult, orderRowsResult, entitlementRowsResult] = await Promise.allSettled([
      getOrgBillingAccount(activeOrgId),
      listBillingOrders(activeOrgId),
      listBillingEntitlements(activeOrgId),
    ]);

    const account = accountResult.status === "fulfilled" ? accountResult.value : null;
    const orderRows = orderRowsResult.status === "fulfilled" ? orderRowsResult.value : [];
    const entitlementRows = entitlementRowsResult.status === "fulfilled" ? entitlementRowsResult.value : [];

    const readErrors = [accountResult, orderRowsResult, entitlementRowsResult]
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason);

    const billingInfraMessage = readErrors.map((error) => getBillingInfraMessage(error)).find(Boolean) ?? null;

    if (billingInfraMessage) {
      setNotice({ tone: "err", text: billingInfraMessage });
    }

    if (!billingEmailDirtyRef.current || billingEmailOrgIdRef.current !== activeOrgId) {
      setBillingEmail(account?.billing_email ?? "");
      billingEmailOrgIdRef.current = activeOrgId;
      billingEmailDirtyRef.current = false;
    }
    setOrders(orderRows);
    setEntitlements(entitlementRows);

    const itemEntries = await Promise.all(
      orderRows.slice(0, 8).map(async (order) => [order.id, await listBillingOrderItems(order.id)] as const)
    );
    setOrderItemsById(Object.fromEntries(itemEntries));
  }, [activeOrgId]);

  useEffect(() => {
    if (!isPermAdmin) return;
    void load().catch((error) => {
      setNotice({ tone: "err", text: getErrorMessage(error, "Failed to load billing workspace.") });
    });
  }, [isPermAdmin, load]);

  useAutoRefresh(
    async () => {
      await load();
    },
    { enabled: isPermAdmin, intervalMs: 30000 }
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

  const preset = ORDER_PRESETS.find((item) => item.key === presetKey) ?? ORDER_PRESETS[0];

  return (
    <div className="space-y-5">
      <div className="surface shadow-soft rounded-[var(--studio-radius)] overflow-hidden">
        <div className="relative px-5 py-5 md:px-6 md:py-6">
          <div className="relative grid gap-5 lg:grid-cols-[1.3fr_0.9fr] lg:items-start">
            <div className="space-y-4">
              <div className="ui-eyebrow">
                <Sparkles className="h-3.5 w-3.5" />
                Admin billing workspace
              </div>

              <div className="space-y-2">
                <h1 className="text-[28px] font-semibold tracking-tight">Control paid live access without turning Decisionary into self-serve SaaS.</h1>
                <p className="max-w-[62ch] text-sm leading-7 text-[color:var(--studio-muted)]">
                  Create billable orders, open Stripe invoice flows, and grant manual entitlements while keeping Decisionary as the source of truth for access.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="ui-metric-card">
                <div className="ui-metric-label">Active entitlements</div>
                <div className="mt-2 text-3xl font-semibold">{activeEntitlements.length}</div>
              </div>
              <div className="ui-metric-card">
                <div className="ui-metric-label">Pending orders</div>
                <div className="mt-2 text-3xl font-semibold">{pendingOrders.length}</div>
              </div>
              <div className="ui-metric-card">
                <div className="ui-metric-label">Organization</div>
                <div className="mt-2 text-lg font-semibold">{activeOrg?.name ?? "Pick org"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {notice ? (
        <div role={notice.tone === "err" ? "alert" : "status"} className={toneClass(notice.tone)}>
          {notice.text}
        </div>
      ) : null}

      {!activeOrgId ? (
        <Card>
          <CardHeader>
            <CardTitle>Select an organization</CardTitle>
            <CardDescription>Billing is provisioned per organization, so pick one in the current workspace context first.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_1.9fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 opacity-80" />
                  Billing profile
                </CardTitle>
                <CardDescription>Keep the customer record and Stripe customer mapping tied to the selected organization.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="ui-form-label">Billing email</label>
                    <Input
                      value={billingEmail}
                      onChange={(e) => {
                        setBillingEmail(e.target.value);
                        billingEmailDirtyRef.current = true;
                      }}
                      placeholder="billing@client.com"
                    />
                  </div>

                <Button
                  disabled={busyKey === "billing-account"}
                  onClick={() => {
                    void (async () => {
                      try {
                        setBusyKey("billing-account");
                        const account = await upsertOrgBillingAccount({
                          orgId: activeOrgId,
                          billingEmail: billingEmail || null,
                        });
                        setBillingAccount(account);
                        setBillingEmail(account.billing_email ?? "");
                        billingEmailOrgIdRef.current = activeOrgId;
                        billingEmailDirtyRef.current = false;
                        setNotice({ tone: "ok", text: "Billing profile updated." });
                      } catch (error) {
                        setNotice({ tone: "err", text: getErrorMessage(error, "Failed to update billing profile.") });
                      } finally {
                        setBusyKey(null);
                      }
                    })();
                  }}
                >
                  {busyKey === "billing-account" ? "Saving…" : "Save billing profile"}
                </Button>

                <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-3 text-sm text-[color:var(--studio-muted)]">
                  Stripe customer: {billingAccount?.stripe_customer_id ?? "Not created yet"}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 opacity-80" />
                  Manual entitlement
                </CardTitle>
                <CardDescription>Use this for demos, exceptions, or enterprise hand-grants outside a paid Stripe flow.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="ui-form-label">Entitlement type</label>
                    <Select
                      value={grantType}
                      onChange={(e) => setGrantType((e.target.value as BillingItemType) ?? "live_exercise")}
                    >
                      <option value="live_exercise">Live exercise</option>
                      <option value="scenario_template">Scenario template access</option>
                      <option value="custom_scenario_service">Custom scenario service</option>
                    </Select>
                  </div>
                  <div>
                    <label className="ui-form-label">Quantity</label>
                    <Input value={grantQuantity} onChange={(e) => setGrantQuantity(e.target.value)} />
                  </div>
                </div>

                {grantType === "live_exercise" ? (
                  <div>
                    <label className="ui-form-label">Participant tier</label>
                    <Select value={grantLimit} onChange={(e) => setGrantLimit(e.target.value)}>
                      <option value="5">Up to 5</option>
                      <option value="10">Up to 10</option>
                      <option value="15">Up to 15</option>
                    </Select>
                  </div>
                ) : null}

                <div>
                  <label className="ui-form-label">Title</label>
                  <Input value={grantTitle} onChange={(e) => setGrantTitle(e.target.value)} placeholder="Manual access title" />
                </div>

                <Button
                  disabled={busyKey === "grant"}
                  onClick={() => {
                    void (async () => {
                      try {
                        setBusyKey("grant");
                        await manualGrantBillingEntitlement({
                          orgId: activeOrgId,
                          entitlementType: grantType,
                          title: grantTitle,
                          participantLimit: grantType === "live_exercise" ? Number(grantLimit) : null,
                          quantity: Math.max(1, Number(grantQuantity) || 1),
                          scenarioSource:
                            grantType === "live_exercise"
                              ? "own_scenario"
                              : grantType === "scenario_template"
                              ? "template"
                              : "custom_service",
                        });
                        await load();
                        setNotice({ tone: "ok", text: "Manual entitlement granted." });
                      } catch (error) {
                        setNotice({ tone: "err", text: getErrorMessage(error, "Failed to grant entitlement.") });
                      } finally {
                        setBusyKey(null);
                      }
                    })();
                  }}
                >
                  {busyKey === "grant" ? "Granting…" : "Grant entitlement"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 opacity-80" />
                  Create billable order
                </CardTitle>
                <CardDescription>Create the commercial package internally first, then open a Stripe invoice flow from that order.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="ui-form-label">Package</label>
                    <Select value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
                      {ORDER_PRESETS.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="ui-form-label">Quantity</label>
                    <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  </div>

                  <div>
                    <label className="ui-form-label">Unit amount (minor units)</label>
                    <Input value={unitAmount} onChange={(e) => setUnitAmount(e.target.value)} placeholder="150000" />
                  </div>

                  <div>
                    <label className="ui-form-label">Notes</label>
                    <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional internal note" />
                  </div>
                </div>

                <div className="rounded-[14px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-3 text-sm text-[color:var(--studio-muted)]">
                  {preset.itemType === "live_exercise"
                    ? `This order will provision live exercise access up to ${preset.participantLimit} participants after Stripe marks the invoice as paid.`
                    : `This order will provision ${preset.label.toLowerCase()} after Stripe marks the invoice as paid.`}
                </div>

                <Button
                  disabled={busyKey === "order-create"}
                  onClick={() => {
                    void (async () => {
                      try {
                        setBusyKey("order-create");
                        const order = await createBillingOrder({
                          orgId: activeOrgId,
                          notes: notes || null,
                          items: [
                            {
                              item_type: preset.itemType,
                              scenario_source: preset.scenarioSource,
                              title: preset.title,
                              participant_limit: preset.participantLimit,
                              quantity: Math.max(1, Number(quantity) || 1),
                              unit_amount: Math.max(0, Number(unitAmount) || 0),
                            },
                          ],
                        });
                        await load();
                        setNotice({ tone: "ok", text: `Order ${order.id.slice(0, 8)} created.` });
                      } catch (error) {
                        setNotice({ tone: "err", text: getErrorMessage(error, "Failed to create order.") });
                      } finally {
                        setBusyKey(null);
                      }
                    })();
                  }}
                >
                  {busyKey === "order-create" ? "Creating…" : "Create order"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current entitlements</CardTitle>
                <CardDescription>Decisionary access is ultimately provisioned here, whether it came from Stripe or a manual admin grant.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {entitlements.length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-[var(--studio-border)] px-4 py-5 text-sm text-[color:var(--studio-muted)]">
                    No entitlements yet for this organization.
                  </div>
                ) : (
                  entitlements.map((item) => (
                    <div key={item.id} className="rounded-[14px] border border-[var(--studio-border)] px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium">{item.title}</div>
                        <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                          {item.entitlement_type.replaceAll("_", " ")}
                        </span>
                        <span className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-[color:var(--studio-muted)]">
                        {item.participant_limit ? `Cap ${item.participant_limit} participants` : "No participant cap"} ·
                        {" "}remaining {item.remaining_quantity}/{item.quantity}
                        {" "}· {item.granted_manually ? "manual grant" : "paid order"}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent orders</CardTitle>
                <CardDescription>Create the order first, then generate or reopen the Stripe invoice path when you are ready to charge the customer.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {visibleOrders.length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-[var(--studio-border)] px-4 py-5 text-sm text-[color:var(--studio-muted)]">
                    No orders yet for this organization.
                  </div>
                ) : (
                  <>
                    {orders.length > visibleOrders.length ? (
                      <div className="text-sm text-[color:var(--studio-muted)]">
                        Showing the 8 most recent orders.
                      </div>
                    ) : null}
                    {visibleOrders.map((order) => (
                    <div key={order.id} className="rounded-[14px] border border-[var(--studio-border)] px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{money(order.total_amount, order.currency)}</div>
                          <div className="text-xs text-[color:var(--studio-muted2)]">
                            {order.status} · created {new Date(order.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {order.stripe_invoice_url ? (
                            <Button variant="outline" asChild>
                              <a href={order.stripe_invoice_url} target="_blank" rel="noreferrer" className="gap-2">
                                <ExternalLink className="h-4 w-4" />
                                Open invoice
                              </a>
                            </Button>
                          ) : null}
                          {!order.stripe_invoice_url ? (
                            <Button
                              variant="secondary"
                              disabled={busyKey === `invoice:${order.id}` || order.status === "paid"}
                              onClick={() => {
                                void (async () => {
                                  try {
                                    setBusyKey(`invoice:${order.id}`);
                                    const result = await createStripeInvoiceForOrder(order.id);
                                    await load();
                                    if (result.invoiceUrl) {
                                      window.open(result.invoiceUrl, "_blank", "noopener,noreferrer");
                                    }
                                    setNotice({ tone: "ok", text: "Stripe invoice created." });
                                  } catch (error) {
                                    setNotice({ tone: "err", text: getErrorMessage(error, "Failed to create Stripe invoice.") });
                                  } finally {
                                    setBusyKey(null);
                                  }
                                })();
                              }}
                            >
                              {busyKey === `invoice:${order.id}` ? "Opening…" : "Create invoice"}
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      {(orderItemsById[order.id] ?? []).length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {(orderItemsById[order.id] ?? []).map((item) => (
                            <div key={item.id} className="rounded-[12px] border border-[var(--studio-border)] bg-[var(--studio-surface2)] px-3 py-2 text-sm">
                              <div className="font-medium">{item.title}</div>
                              <div className="text-[color:var(--studio-muted)]">
                                {item.quantity} × {money(item.unit_amount, order.currency)}
                                {item.participant_limit ? ` · up to ${item.participant_limit} participants` : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
