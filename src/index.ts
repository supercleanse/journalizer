import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppContext } from "./types/env";
import { authMiddleware } from "./lib/auth";
import { errorHandler, RouteNotFound } from "./lib/errors";

// Glass contract: failure modes (handled by errorHandler middleware)
export { AuthenticationRequired, InternalError } from "./lib/errors";
import authRoutes from "./routes/auth";
import entriesRoutes from "./routes/entries";
import mediaRoutes from "./routes/media";
import settingsRoutes from "./routes/settings";
import remindersRoutes from "./routes/reminders";
import exportRoutes from "./routes/exportRoutes";
import webhooksRoutes from "./routes/webhooks";
import { handleCron } from "./services/reminders";
import type { Env } from "./types/env";

const app = new Hono<AppContext>();

// Global middleware
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (c.env.ENVIRONMENT !== "production") return origin;
      const allowed = (c.env.ALLOWED_ORIGINS || "").split(",").map((s: string) => s.trim());
      return allowed.includes(origin) ? origin : null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Global error handler
app.onError(errorHandler);

// Health check
app.get("/", (c) => {
  return c.json({ name: "journalizer", version: "0.1.0", status: "ok" });
});

// Public routes
app.route("/auth", authRoutes);

// Webhooks (their own auth — Twilio signature, Lulu API key)
app.route("/api/webhooks", webhooksRoutes);

// Protected routes (require auth)
app.use("/api/*", authMiddleware);
app.route("/api/entries", entriesRoutes);
app.route("/api/media", mediaRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/reminders", remindersRoutes);
app.route("/api/export", exportRoutes);

// 404 handler for unmatched routes
app.notFound(() => {
  throw new RouteNotFound();
});

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleCron(env));
  },
};
