import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { getStripe, getStripeWebhookSecret } from "@/lib/server/stripe";

async function markWebhookProcessed(eventId: string, eventType: string, payload: unknown) {
  const adminClient = createSupabaseAdminClient();

  const { data: existing } = await adminClient
    .from("billing_webhook_events")
    .select("stripe_event_id")
    .eq("stripe_event_id", eventId)
    .maybeSingle();

  if (existing) return false;

  const { error } = await adminClient.from("billing_webhook_events").insert({
    stripe_event_id: eventId,
    event_type: eventType,
    payload,
  });

  if (error) {
    const message = String(error.message ?? "");
    if (message.toLowerCase().includes("duplicate")) return false;
    throw error;
  }

  return true;
}

async function provisionOrderFromInvoice(invoice: { id: string; payment_intent?: string | null; metadata?: Record<string, string> | null }) {
  const adminClient = createSupabaseAdminClient();

  let orderId = invoice.metadata?.order_id ?? null;
  let orderQuery = adminClient
    .from("billing_orders")
    .select("*")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle();

  let { data: order, error: orderError } = await orderQuery;
  if (orderError) throw orderError;

  if (!order && orderId) {
    const fallback = await adminClient
      .from("billing_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (fallback.error) throw fallback.error;
    order = fallback.data;
  }

  if (!order) return;

  const nowIso = new Date().toISOString();

  await adminClient
    .from("billing_orders")
    .update({
      status: "paid",
      paid_at: order.paid_at ?? nowIso,
      stripe_invoice_id: order.stripe_invoice_id ?? invoice.id,
      stripe_payment_intent_id: order.stripe_payment_intent_id ?? invoice.payment_intent ?? null,
    })
    .eq("id", order.id);

  const { data: items, error: itemsError } = await adminClient
    .from("billing_order_items")
    .select("*")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  if (itemsError) throw itemsError;

  for (const item of items ?? []) {
    const { data: existingEntitlement, error: existingError } = await adminClient
      .from("billing_entitlements")
      .select("id")
      .eq("source_order_item_id", item.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingEntitlement) continue;

    await adminClient.from("billing_entitlements").insert({
      org_id: order.org_id,
      source_order_id: order.id,
      source_order_item_id: item.id,
      entitlement_type: item.item_type,
      scenario_source: item.scenario_source,
      title: item.title,
      participant_limit: item.participant_limit,
      quantity: item.quantity,
      remaining_quantity: item.quantity,
      status: "active",
      activate_at: nowIso,
      granted_manually: false,
      created_by: order.created_by,
      updated_by: order.created_by,
    });
  }

  await adminClient
    .from("billing_orders")
    .update({
      status: "paid",
      paid_at: order.paid_at ?? nowIso,
      provisioned_at: nowIso,
      stripe_invoice_id: order.stripe_invoice_id ?? invoice.id,
      stripe_payment_intent_id: order.stripe_payment_intent_id ?? invoice.payment_intent ?? null,
    })
    .eq("id", order.id);
}

export async function POST(request: Request) {
  try {
    const stripeWebhookSecret = getStripeWebhookSecret();
    if (!stripeWebhookSecret) {
      return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
    }

    const stripe = getStripe();
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
    const shouldProcess = await markWebhookProcessed(event.id, event.type, event);

    if (!shouldProcess) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (event.type === "invoice.paid") {
      await provisionOrderFromInvoice(event.data.object as { id: string; payment_intent?: string | null; metadata?: Record<string, string> | null });
    }

    if (event.type === "invoice.payment_failed" || event.type === "invoice.voided") {
      const invoice = event.data.object as { id: string };
      const adminClient = createSupabaseAdminClient();
      await adminClient
        .from("billing_orders")
        .update({
          status: event.type === "invoice.voided" ? "cancelled" : "failed",
        })
        .eq("stripe_invoice_id", invoice.id);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe webhook failed";
    console.error("[stripe.webhook]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
