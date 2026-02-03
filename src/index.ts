import { Hono } from "hono";
import type { AppContext } from "./types/env";
import authRoutes from "./routes/auth";

const app = new Hono<AppContext>();

app.get("/", (c) => {
  return c.json({ name: "journalizer", version: "0.1.0", status: "ok" });
});

app.route("/auth", authRoutes);

export default app;
