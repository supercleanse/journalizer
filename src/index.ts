import { Hono } from "hono";
import type { Env } from "./types/env";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
  return c.json({ name: "journalizer", version: "0.1.0", status: "ok" });
});

export default app;
