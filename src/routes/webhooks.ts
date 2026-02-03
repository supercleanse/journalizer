import { Hono } from "hono";
import type { Env } from "../types/env";

// Webhooks use Env directly — they have their own auth (Twilio signature, Lulu API key)
const webhooks = new Hono<{ Bindings: Env }>();

// POST /api/webhooks/twilio — inbound SMS/MMS from Twilio
webhooks.post("/twilio", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

// POST /api/webhooks/lulu — print order status from Lulu
webhooks.post("/lulu", async (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

export default webhooks;
