import { Hono } from "hono";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import {
  getUserById,
  listPrintSubscriptions,
  getPrintSubscriptionById,
  createPrintSubscription,
  updatePrintSubscription,
  deletePrintSubscription,
  listPrintOrders,
} from "../db/queries";
import { fetchEntriesForExport } from "../services/export";
import { generateInteriorPdf } from "../services/printPdf";
import type { PrintPdfOptions } from "../services/printPdf";
import {
  getAccessToken,
  calculateCost,
  getPodPackageId,
  getRetailPriceCents,
} from "../services/lulu";
import type { LuluShippingAddress } from "../services/lulu";
import {
  ValidationError,
  PrintSubscriptionNotFound,
} from "../lib/errors";

// Glass contract: failure modes
export { ValidationError, PrintSubscriptionNotFound, DatabaseError } from "../lib/errors";

const printRoutes = new Hono<AppContext>();

const VALID_FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"];

function validateSubscriptionInput(body: Record<string, unknown>) {
  const { frequency, shippingName, shippingLine1, shippingCity, shippingState, shippingZip } = body;

  if (!frequency || !VALID_FREQUENCIES.includes(frequency as string)) {
    throw new ValidationError("frequency must be weekly, monthly, quarterly, or yearly");
  }
  if (!shippingName || typeof shippingName !== "string" || !shippingName.trim()) {
    throw new ValidationError("shippingName is required");
  }
  if (!shippingLine1 || typeof shippingLine1 !== "string" || !shippingLine1.trim()) {
    throw new ValidationError("shippingLine1 is required");
  }
  if (!shippingCity || typeof shippingCity !== "string" || !shippingCity.trim()) {
    throw new ValidationError("shippingCity is required");
  }
  if (!shippingState || typeof shippingState !== "string" || !shippingState.trim()) {
    throw new ValidationError("shippingState is required");
  }
  if (!shippingZip || typeof shippingZip !== "string" || !shippingZip.trim()) {
    throw new ValidationError("shippingZip is required");
  }
}

// ── Subscription CRUD ───────────────────────────────────────────────

/**
 * GET /api/print/subscriptions — List user's print subscriptions
 */
printRoutes.get("/subscriptions", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const subs = await listPrintSubscriptions(db, userId);
  return c.json({ subscriptions: subs });
});

/**
 * POST /api/print/subscriptions — Create a new print subscription
 */
printRoutes.post("/subscriptions", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const body = await c.req.json<Record<string, unknown>>();

  validateSubscriptionInput(body);

  // Calculate next print date (start of next period from today)
  const today = new Date().toISOString().split("T")[0];

  const sub = await createPrintSubscription(db, {
    id: crypto.randomUUID(),
    userId,
    frequency: body.frequency as string,
    shippingName: (body.shippingName as string).trim(),
    shippingLine1: (body.shippingLine1 as string).trim(),
    shippingLine2: body.shippingLine2 ? (body.shippingLine2 as string).trim() : undefined,
    shippingCity: (body.shippingCity as string).trim(),
    shippingState: (body.shippingState as string).trim(),
    shippingZip: (body.shippingZip as string).trim(),
    shippingCountry: (body.shippingCountry as string) || "US",
    colorOption: (body.colorOption as string) || "bw",
    includeImages: body.includeImages === false ? 0 : 1,
    nextPrintDate: today,
  });

  return c.json({ subscription: sub }, 201);
});

/**
 * PUT /api/print/subscriptions/:id — Update a print subscription
 */
printRoutes.put("/subscriptions/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const existing = await getPrintSubscriptionById(db, id, userId);
  if (!existing) throw new PrintSubscriptionNotFound();

  const body = await c.req.json<Record<string, unknown>>();

  const updates: Record<string, unknown> = {};

  if (body.frequency !== undefined) {
    if (!VALID_FREQUENCIES.includes(body.frequency as string)) {
      throw new ValidationError("frequency must be weekly, monthly, quarterly, or yearly");
    }
    updates.frequency = body.frequency;
  }
  if (body.isActive !== undefined) updates.isActive = body.isActive ? 1 : 0;
  if (body.shippingName !== undefined) updates.shippingName = (body.shippingName as string).trim();
  if (body.shippingLine1 !== undefined) updates.shippingLine1 = (body.shippingLine1 as string).trim();
  if (body.shippingLine2 !== undefined) updates.shippingLine2 = body.shippingLine2 ? (body.shippingLine2 as string).trim() : null;
  if (body.shippingCity !== undefined) updates.shippingCity = (body.shippingCity as string).trim();
  if (body.shippingState !== undefined) updates.shippingState = (body.shippingState as string).trim();
  if (body.shippingZip !== undefined) updates.shippingZip = (body.shippingZip as string).trim();
  if (body.shippingCountry !== undefined) updates.shippingCountry = body.shippingCountry as string;
  if (body.colorOption !== undefined) updates.colorOption = body.colorOption as string;
  if (body.includeImages !== undefined) updates.includeImages = body.includeImages ? 1 : 0;

  const sub = await updatePrintSubscription(db, id, userId, updates as Parameters<typeof updatePrintSubscription>[3]);
  return c.json({ subscription: sub });
});

/**
 * DELETE /api/print/subscriptions/:id — Deactivate a print subscription
 */
printRoutes.delete("/subscriptions/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const db = createDb(c.env.DB);

  const existing = await getPrintSubscriptionById(db, id, userId);
  if (!existing) throw new PrintSubscriptionNotFound();

  await updatePrintSubscription(db, id, userId, { isActive: 0 });
  return c.json({ success: true });
});

// ── Orders ──────────────────────────────────────────────────────────

/**
 * GET /api/print/orders — List user's print orders
 */
printRoutes.get("/orders", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const orders = await listPrintOrders(db, userId);
  return c.json({ orders });
});

/**
 * POST /api/print/orders/preview — Preview cost for a print period
 */
printRoutes.post("/orders/preview", async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const body = await c.req.json<{
    frequency: string;
    startDate: string;
    endDate: string;
    colorOption?: string;
    includeImages?: boolean;
    shippingState?: string;
    shippingZip?: string;
    shippingCountry?: string;
  }>();

  if (!body.frequency || !VALID_FREQUENCIES.includes(body.frequency)) {
    throw new ValidationError("frequency must be weekly, monthly, quarterly, or yearly");
  }
  if (!body.startDate || !body.endDate) {
    throw new ValidationError("startDate and endDate are required");
  }

  // Fetch entries to count pages
  const entries = await fetchEntriesForExport(db, c.env, {
    userId,
    startDate: body.startDate,
    endDate: body.endDate,
    entryTypes: "both",
    includeImages: body.includeImages !== false,
    includeMultimedia: false,
  });

  const user = await getUserById(db, userId);
  const pdfOptions: PrintPdfOptions = {
    userName: user?.displayName || "My Journal",
    timezone: user?.timezone || "UTC",
    startDate: body.startDate,
    endDate: body.endDate,
    frequency: body.frequency,
    colorOption: body.colorOption || "bw",
  };

  const { pageCount } = generateInteriorPdf(entries, pdfOptions);
  const podPackageId = getPodPackageId(body.frequency, body.colorOption || "bw");

  // Try to get cost from Lulu if configured
  let costCents: number | null = null;
  let retailCents: number | null = null;

  if (c.env.LULU_API_KEY && c.env.LULU_API_SECRET) {
    try {
      const sandbox = c.env.LULU_SANDBOX === "true";
      const token = await getAccessToken(c.env.LULU_API_KEY, c.env.LULU_API_SECRET, sandbox);
      const address: LuluShippingAddress = {
        name: "Preview",
        street1: "123 Main St",
        city: "Denver",
        state_code: body.shippingState || "CO",
        country_code: body.shippingCountry || "US",
        postcode: body.shippingZip || "80202",
        phone_number: "0000000000",
        email: user?.email || "preview@example.com",
      };
      const result = await calculateCost(token, sandbox, {
        podPackageId,
        pageCount,
        shippingAddress: address,
      });
      costCents = result.costCents;
      retailCents = getRetailPriceCents(body.frequency, costCents);
    } catch {
      // Cost calculation failed — return page count without cost
    }
  }

  return c.json({
    entryCount: entries.length,
    pageCount,
    costCents,
    retailCents,
    frequency: body.frequency,
    podPackageId,
  });
});

export default printRoutes;
