import { LuluAPIError } from "../lib/errors";

// Glass contract: failure modes
export { LuluAPIError } from "../lib/errors";

// ── Configuration ───────────────────────────────────────────────────

function getBaseUrl(sandbox: boolean): string {
  return sandbox ? "https://api.sandbox.lulu.com" : "https://api.lulu.com";
}

function getAuthUrl(sandbox: boolean): string {
  const base = sandbox
    ? "https://api.sandbox.lulu.com"
    : "https://api.lulu.com";
  return `${base}/auth/realms/glasstree/protocol/openid-connect/token`;
}

// Pod package IDs: {TrimSize}{Color}{Quality}{Bind}{Paper}{PPI}{Finish}{Linen}{Foil}
// Weekly booklets: 5.5x8.5, others: 6x9, all perfect-bound
const POD_PACKAGES = {
  "weekly-bw": "0550X0850BWSTDPB060UW444MXX",
  "weekly-color": "0550X0850FCSTDPB060UW444MXX",
  "default-bw": "0600X0900BWSTDPB060UW444MXX",
  "default-color": "0600X0900FCSTDPB080CW444GXX",
} as const;

export function getPodPackageId(
  frequency: string,
  colorOption: string
): string {
  const isColor = colorOption === "color";
  if (frequency === "weekly") {
    return isColor ? POD_PACKAGES["weekly-color"] : POD_PACKAGES["weekly-bw"];
  }
  return isColor ? POD_PACKAGES["default-color"] : POD_PACKAGES["default-bw"];
}

// ── Auth ────────────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(
  apiKey: string,
  apiSecret: string,
  sandbox: boolean
): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const authUrl = getAuthUrl(sandbox);
  const credentials = btoa(`${apiKey}:${apiSecret}`);

  const res = await fetch(authUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new LuluAPIError(`Lulu auth failed (${res.status})`);
  }

  const data = (await res.json()) as TokenResponse;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

// ── API Request Helper ──────────────────────────────────────────────

async function luluRequest<T>(
  token: string,
  sandbox: boolean,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${getBaseUrl(sandbox)}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const data = (await res.json()) as T & { detail?: string; message?: string };

  if (!res.ok) {
    const msg = data.detail ?? data.message ?? `Lulu API error (${res.status})`;
    throw new LuluAPIError(msg);
  }

  return data;
}

// ── Shipping Address ────────────────────────────────────────────────

export interface LuluShippingAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state_code: string;
  country_code: string;
  postcode: string;
  phone_number: string;
  email: string;
}

// ── Print Jobs ──────────────────────────────────────────────────────

interface LineItem {
  external_id?: string;
  pod_package_id: string;
  quantity: number;
  title: string;
  interior: { source_url: string };
  cover: { source_url: string };
}

interface CreatePrintJobRequest {
  external_id: string;
  line_items: LineItem[];
  shipping_option_level: string;
  contact_email: string;
  shipping_address: LuluShippingAddress;
}

export interface LuluPrintJob {
  id: number;
  status: { name: string };
  external_id: string;
  line_items: Array<{
    id: number;
    tracking_id: string | null;
    tracking_urls: string[];
  }>;
  costs: {
    total_cost_incl_tax: string;
    total_cost_excl_tax: string;
    currency: string;
  };
  estimated_shipping_dates?: {
    arrival_min: string;
    arrival_max: string;
  };
}

export async function createPrintJob(
  token: string,
  sandbox: boolean,
  options: {
    externalId: string;
    podPackageId: string;
    title: string;
    interiorUrl: string;
    coverUrl: string;
    shippingAddress: LuluShippingAddress;
    contactEmail: string;
  }
): Promise<LuluPrintJob> {
  const body: CreatePrintJobRequest = {
    external_id: options.externalId,
    line_items: [
      {
        pod_package_id: options.podPackageId,
        quantity: 1,
        title: options.title,
        interior: { source_url: options.interiorUrl },
        cover: { source_url: options.coverUrl },
      },
    ],
    shipping_option_level: "MAIL",
    contact_email: options.contactEmail,
    shipping_address: options.shippingAddress,
  };

  return luluRequest<LuluPrintJob>(
    token,
    sandbox,
    "POST",
    "/print-jobs/",
    body
  );
}

export async function getPrintJob(
  token: string,
  sandbox: boolean,
  jobId: number
): Promise<LuluPrintJob> {
  return luluRequest<LuluPrintJob>(
    token,
    sandbox,
    "GET",
    `/print-jobs/${jobId}`
  );
}

// ── Cost Calculation ────────────────────────────────────────────────

interface CostCalculationResponse {
  currency: string;
  total_cost_excl_tax: string;
  total_cost_incl_tax: string;
  total_tax: string;
  line_item_costs: Array<{
    total_cost_excl_tax: string;
    total_cost_incl_tax: string;
  }>;
  shipping_cost: {
    total_cost_excl_tax: string;
    total_cost_incl_tax: string;
  };
  fulfillment_cost: {
    total_cost_excl_tax: string;
    total_cost_incl_tax: string;
  };
}

export async function calculateCost(
  token: string,
  sandbox: boolean,
  options: {
    podPackageId: string;
    pageCount: number;
    shippingAddress: LuluShippingAddress;
  }
): Promise<{ costCents: number; currency: string }> {
  const body = {
    line_items: [
      {
        pod_package_id: options.podPackageId,
        page_count: options.pageCount,
        quantity: 1,
      },
    ],
    shipping_address: {
      city: options.shippingAddress.city,
      country_code: options.shippingAddress.country_code,
      postcode: options.shippingAddress.postcode,
      state_code: options.shippingAddress.state_code,
      street1: options.shippingAddress.street1,
      phone_number: options.shippingAddress.phone_number,
    },
    shipping_option: "MAIL",
  };

  const result = await luluRequest<CostCalculationResponse>(
    token,
    sandbox,
    "POST",
    "/print-job-cost-calculations/",
    body
  );

  const totalCostStr = result.total_cost_incl_tax;
  const costCents = Math.round(parseFloat(totalCostStr) * 100);

  return { costCents, currency: result.currency };
}

// ── Webhook Verification ────────────────────────────────────────────

export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computed === signature;
}

// ── Markup Calculation ──────────────────────────────────────────────

// Retail prices: roughly 2x cost, rounded to .99
const RETAIL_PRICES: Record<string, number> = {
  weekly: 1299,
  monthly: 1799,
  quarterly: 2499,
  yearly: 3999,
};

export function getRetailPriceCents(
  frequency: string,
  costCents: number
): number {
  // Use fixed retail price if available, otherwise 2x cost rounded up to nearest .99
  const fixed = RETAIL_PRICES[frequency];
  if (fixed) return fixed;
  const doubled = costCents * 2;
  return Math.ceil(doubled / 100) * 100 - 1;
}
