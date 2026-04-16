import { supabase } from "./supabaseClient";

export type BillingOrderStatus =
  | "draft"
  | "payment_pending"
  | "paid"
  | "cancelled"
  | "failed"
  | "expired";

export type BillingItemType =
  | "live_exercise"
  | "scenario_template"
  | "custom_scenario_service";

export type BillingScenarioSource =
  | "own_scenario"
  | "template"
  | "custom_service";

export type BillingAccount = {
  org_id: string;
  billing_email: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type BillingOrder = {
  id: string;
  org_id: string;
  status: BillingOrderStatus;
  currency: string;
  subtotal_amount: number;
  total_amount: number;
  notes: string | null;
  stripe_customer_id: string | null;
  stripe_invoice_id: string | null;
  stripe_invoice_url: string | null;
  stripe_payment_intent_id: string | null;
  payment_requested_at: string | null;
  paid_at: string | null;
  provisioned_at: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type BillingOrderItem = {
  id: string;
  order_id: string;
  item_type: BillingItemType;
  scenario_source: BillingScenarioSource | null;
  title: string;
  description: string | null;
  participant_limit: number | null;
  quantity: number;
  unit_amount: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type BillingEntitlementStatus =
  | "pending"
  | "active"
  | "consumed"
  | "expired"
  | "revoked";

export type BillingEntitlement = {
  id: string;
  org_id: string;
  source_order_id: string | null;
  source_order_item_id: string | null;
  entitlement_type: BillingItemType;
  scenario_source: BillingScenarioSource | null;
  title: string;
  participant_limit: number | null;
  quantity: number;
  remaining_quantity: number;
  status: BillingEntitlementStatus;
  activate_at: string;
  expires_at: string | null;
  granted_manually: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type LiveExerciseAccess = {
  entitlement_id: string;
  org_id: string;
  title: string;
  participant_limit: number;
  remaining_quantity: number;
  expires_at: string | null;
  status: BillingEntitlementStatus;
};

export function getBillingInfraMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;

  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";

  const looksLikeBillingInfraGap =
    code === "PGRST202" ||
    message.includes("schema cache") ||
    message.includes("list_my_live_exercise_access") ||
    message.includes("admin_get_org_billing_account") ||
    message.includes("admin_upsert_org_billing_account") ||
    message.includes("admin_list_billing_orders") ||
    message.includes("admin_list_billing_order_items") ||
    message.includes("admin_list_billing_entitlements") ||
    message.includes("admin_create_billing_order") ||
    message.includes("admin_manual_grant_billing_entitlement") ||
    message.includes("billing_orders") ||
    message.includes("billing_order_items") ||
    message.includes("billing_entitlements") ||
    message.includes("org_billing_accounts");

  if (!looksLikeBillingInfraGap) return null;

  return "Billing migration is not available in this local database yet. Run the latest Supabase migrations, then refresh the page.";
}

function throwBillingAwareError(error: unknown, fallback: string): never {
  const billingInfraMessage = getBillingInfraMessage(error);
  if (billingInfraMessage) {
    throw new Error(billingInfraMessage);
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error(fallback);
}

export async function listMyLiveExerciseAccess() {
  const { data, error } = await supabase.rpc("list_my_live_exercise_access");
  if (error) {
    const billingInfraMessage = getBillingInfraMessage(error);
    if (billingInfraMessage) return [];
    throw error;
  }
  return (data ?? []) as LiveExerciseAccess[];
}

export async function getOrgBillingAccount(orgId: string) {
  const { data, error } = await supabase.rpc("admin_get_org_billing_account", {
    p_org_id: orgId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as BillingAccount | null;
}

export async function upsertOrgBillingAccount(params: {
  orgId: string;
  billingEmail?: string | null;
}) {
  const { data, error } = await supabase.rpc("admin_upsert_org_billing_account", {
    p_org_id: params.orgId,
    p_billing_email: params.billingEmail ?? null,
  });
  if (error) throwBillingAwareError(error, "Failed to update billing profile.");
  const row = Array.isArray(data) ? data[0] : data;
  return row as BillingAccount;
}

export async function listBillingOrders(orgId: string | null) {
  const { data, error } = await supabase.rpc("admin_list_billing_orders", {
    p_org_id: orgId,
  });
  if (error) throw error;
  return (data ?? []) as BillingOrder[];
}

export async function listBillingOrderItems(orderId: string) {
  const { data, error } = await supabase.rpc("admin_list_billing_order_items", {
    p_order_id: orderId,
  });
  if (error) throw error;
  return (data ?? []) as BillingOrderItem[];
}

export async function listBillingEntitlements(orgId: string | null) {
  const { data, error } = await supabase.rpc("admin_list_billing_entitlements", {
    p_org_id: orgId,
  });
  if (error) throw error;
  return (data ?? []) as BillingEntitlement[];
}

export async function createBillingOrder(params: {
  orgId: string;
  currency?: string;
  notes?: string | null;
  items: Array<{
    item_type: BillingItemType;
    scenario_source?: BillingScenarioSource | null;
    title: string;
    description?: string | null;
    participant_limit?: number | null;
    quantity?: number;
    unit_amount?: number;
    metadata?: Record<string, unknown>;
  }>;
}) {
  const { data, error } = await supabase.rpc("admin_create_billing_order", {
    p_org_id: params.orgId,
    p_currency: params.currency ?? "usd",
    p_notes: params.notes ?? null,
    p_items: params.items,
  });
  if (error) throwBillingAwareError(error, "Failed to create billing order.");
  const row = Array.isArray(data) ? data[0] : data;
  return row as BillingOrder;
}

export async function manualGrantBillingEntitlement(params: {
  orgId: string;
  entitlementType: BillingItemType;
  title: string;
  participantLimit?: number | null;
  quantity?: number;
  scenarioSource?: BillingScenarioSource | null;
  expiresAt?: string | null;
}) {
  const { data, error } = await supabase.rpc("admin_manual_grant_billing_entitlement", {
    p_org_id: params.orgId,
    p_entitlement_type: params.entitlementType,
    p_title: params.title,
    p_participant_limit: params.participantLimit ?? null,
    p_quantity: params.quantity ?? 1,
    p_scenario_source: params.scenarioSource ?? null,
    p_expires_at: params.expiresAt ?? null,
  });
  if (error) throwBillingAwareError(error, "Failed to grant billing entitlement.");
  const row = Array.isArray(data) ? data[0] : data;
  return row as BillingEntitlement;
}

async function fetchWithAdminSession(input: RequestInfo | URL, init?: RequestInit) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (!session?.access_token) throw new Error("Not authenticated");

  const headers = new Headers(init?.headers ?? {});
  headers.set("Authorization", `Bearer ${session.access_token}`);

  return fetch(input, {
    ...init,
    headers,
  });
}

export async function createStripeInvoiceForOrder(orderId: string) {
  const response = await fetchWithAdminSession(`/api/admin/billing/orders/${orderId}/invoice`, {
    method: "POST",
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    invoiceUrl?: string | null;
    invoiceId?: string | null;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to create Stripe invoice.");
  }

  return {
    invoiceUrl: payload.invoiceUrl ?? null,
    invoiceId: payload.invoiceId ?? null,
  };
}
