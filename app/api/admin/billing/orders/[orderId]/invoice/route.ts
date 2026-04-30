import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { requireAdminUserFromBearer } from "@/lib/server/supabaseAdmin";
import { getStripe } from "@/lib/server/stripe";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { orderId } = await context.params;
    const { adminClient } = await requireAdminUserFromBearer(request.headers.get("authorization"));
    const stripe = getStripe();

    const { data: order, error: orderError } = await adminClient
      .from("billing_orders")
      .select("*, organizations:org_id ( id, name, slug )")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.stripe_invoice_id && order.stripe_invoice_url) {
      return NextResponse.json({
        invoiceId: order.stripe_invoice_id,
        invoiceUrl: order.stripe_invoice_url,
      });
    }

    if (order.stripe_invoice_id && !order.stripe_invoice_url) {
      const existingInvoice = await stripe.invoices.retrieve(order.stripe_invoice_id);

      const { error: refreshError } = await adminClient
        .from("billing_orders")
        .update({
          stripe_invoice_url: existingInvoice.hosted_invoice_url,
          stripe_customer_id: order.stripe_customer_id ?? existingInvoice.customer?.toString() ?? null,
        })
        .eq("id", order.id);

      if (refreshError) throw refreshError;

      return NextResponse.json({
        invoiceId: existingInvoice.id,
        invoiceUrl: existingInvoice.hosted_invoice_url,
      });
    }

    const { data: items, error: itemsError } = await adminClient
      .from("billing_order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (itemsError) throw itemsError;
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Order has no items." }, { status: 400 });
    }

    const { data: billingAccount } = await adminClient
      .from("org_billing_accounts")
      .select("*")
      .eq("org_id", order.org_id)
      .maybeSingle();

    let customerId = billingAccount?.stripe_customer_id ?? order.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: order.organizations?.name ?? "Decisionary customer",
        email: billingAccount?.billing_email ?? undefined,
        metadata: {
          org_id: order.org_id,
          org_slug: order.organizations?.slug ?? "",
        },
      });

      customerId = customer.id;

      const { error: billingAccountError } = await adminClient.from("org_billing_accounts").upsert({
        org_id: order.org_id,
        billing_email: billingAccount?.billing_email ?? null,
        stripe_customer_id: customerId,
      });

      if (billingAccountError) throw billingAccountError;
    }

    for (const item of items) {
      const invoiceItemParams = {
        customer: customerId,
        quantity: item.quantity,
        description: item.description ?? item.title,
        currency: order.currency,
        unit_amount_decimal: String(item.unit_amount),
        metadata: {
          order_id: order.id,
          order_item_id: item.id,
          item_type: item.item_type,
          participant_limit: item.participant_limit ? String(item.participant_limit) : "",
          scenario_source: item.scenario_source ?? "",
        },
      } as unknown as Stripe.InvoiceItemCreateParams;

      await stripe.invoiceItems.create(invoiceItemParams, {
        idempotencyKey: `billing-order-item:${order.id}:${item.id}`,
      });
    }

    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: 30,
      auto_advance: true,
      metadata: {
        order_id: order.id,
        org_id: order.org_id,
      },
    }, {
      idempotencyKey: `billing-order-invoice:${order.id}`,
    });

    const finalized = await stripe.invoices.finalizeInvoice(
      invoice.id,
      { expand: ["payment_intent"] },
      { idempotencyKey: `billing-order-finalize:${order.id}` }
    );
    const finalizedInvoice = await stripe.invoices.retrieve(finalized.id, {
      expand: ["payment_intent"],
    });

    const { error: updateError } = await adminClient
      .from("billing_orders")
      .update({
        status: "payment_pending",
        stripe_customer_id: customerId,
        stripe_invoice_id: finalizedInvoice.id,
        stripe_invoice_url: finalizedInvoice.hosted_invoice_url,
        payment_requested_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      invoiceId: finalizedInvoice.id,
      invoiceUrl: finalizedInvoice.hosted_invoice_url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create Stripe invoice.";
    console.error("[admin.billing.invoice]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
