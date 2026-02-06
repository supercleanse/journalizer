import { StripeAPIError, PaymentFailed } from "../lib/errors";

// Glass contract: failure modes
export { StripeAPIError, PaymentFailed } from "../lib/errors";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

function stripeHeaders(secretKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

function encodeForm(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

async function stripeRequest<T>(
  secretKey: string,
  method: string,
  path: string,
  body?: Record<string, string>
): Promise<T> {
  const url = `${STRIPE_API_BASE}${path}`;
  const init: RequestInit = {
    method,
    headers: stripeHeaders(secretKey),
  };
  if (body) {
    init.body = encodeForm(body);
  }
  const res = await fetch(url, init);
  const data = (await res.json()) as T & { error?: { message: string; type: string } };
  if (!res.ok) {
    const msg = data.error?.message ?? `Stripe API error (${res.status})`;
    if (data.error?.type === "card_error") {
      throw new PaymentFailed(msg);
    }
    throw new StripeAPIError(msg);
  }
  return data;
}

// ── Customer ────────────────────────────────────────────────────────

interface StripeCustomer {
  id: string;
  email: string;
  invoice_settings: { default_payment_method: string | null };
}

export async function createCustomer(
  secretKey: string,
  email: string,
  name?: string
): Promise<string> {
  const params: Record<string, string> = { email };
  if (name) params.name = name;
  const customer = await stripeRequest<StripeCustomer>(
    secretKey,
    "POST",
    "/customers",
    params
  );
  return customer.id;
}

function validateCustomerId(id: string): void {
  if (!/^cus_[a-zA-Z0-9]+$/.test(id)) {
    throw new StripeAPIError("Invalid Stripe customer ID");
  }
}

export async function getCustomer(
  secretKey: string,
  customerId: string
): Promise<StripeCustomer> {
  validateCustomerId(customerId);
  return stripeRequest<StripeCustomer>(
    secretKey,
    "GET",
    `/customers/${customerId}`
  );
}

// ── Payment Methods ─────────────────────────────────────────────────

interface StripePaymentMethod {
  id: string;
  type: string;
  card?: { brand: string; last4: string };
}

interface StripeListResponse<T> {
  data: T[];
}

export async function getDefaultPaymentMethod(
  secretKey: string,
  customerId: string
): Promise<string | null> {
  const customer = await getCustomer(secretKey, customerId);
  if (customer.invoice_settings.default_payment_method) {
    return customer.invoice_settings.default_payment_method;
  }
  // Fall back to first available payment method
  const methods = await stripeRequest<StripeListResponse<StripePaymentMethod>>(
    secretKey,
    "GET",
    `/payment_methods?customer=${customerId}&type=card&limit=1`
  );
  return methods.data[0]?.id ?? null;
}

// ── Payment Intents ─────────────────────────────────────────────────

interface StripePaymentIntent {
  id: string;
  status: string;
  amount: number;
  currency: string;
}

export async function chargeCustomer(
  secretKey: string,
  customerId: string,
  amountCents: number,
  description: string
): Promise<string> {
  const paymentMethodId = await getDefaultPaymentMethod(secretKey, customerId);
  if (!paymentMethodId) {
    throw new PaymentFailed("No payment method on file");
  }

  const intent = await stripeRequest<StripePaymentIntent>(
    secretKey,
    "POST",
    "/payment_intents",
    {
      amount: String(amountCents),
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: "true",
      confirm: "true",
      description,
    }
  );

  if (intent.status !== "succeeded") {
    throw new PaymentFailed(`Payment status: ${intent.status}`);
  }

  return intent.id;
}

// ── Refunds ─────────────────────────────────────────────────────────

export async function refundPayment(
  secretKey: string,
  paymentIntentId: string
): Promise<void> {
  await stripeRequest<{ id: string }>(secretKey, "POST", "/refunds", {
    payment_intent: paymentIntentId,
  });
}
