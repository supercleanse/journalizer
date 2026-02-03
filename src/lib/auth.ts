import jwt from "@tsndr/cloudflare-worker-jwt";
import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import { getUserById } from "../db/queries";
import { InvalidToken, MissingToken } from "./errors";

export interface SessionPayload {
  userId: string;
  email: string;
}

export async function createSessionJWT(
  payload: SessionPayload,
  secret: string
): Promise<string> {
  return jwt.sign(
    {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    },
    secret
  );
}

export async function verifySessionJWT(
  token: string,
  secret: string
): Promise<SessionPayload | null> {
  try {
    const valid = await jwt.verify(token, secret);
    if (!valid) return null;

    const { payload } = jwt.decode(token);
    if (!payload || typeof payload !== "object") return null;

    const p = payload as Record<string, unknown>;
    if (typeof p.userId !== "string" || typeof p.email !== "string") {
      return null;
    }

    return { userId: p.userId, email: p.email };
  } catch {
    return null;
  }
}

export function setSessionCookie(
  c: Context<AppContext, string>,
  token: string
) {
  const isProduction = c.env?.ENVIRONMENT === "production";
  setCookie(c, "session", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
  });
}

export function clearSessionCookie(c: Context<AppContext, string>) {
  deleteCookie(c, "session", { path: "/" });
}

export async function authMiddleware(
  c: Context<AppContext, string>,
  next: Next
) {
  const token = getCookie(c, "session");
  if (!token) {
    throw new MissingToken();
  }

  const payload = await verifySessionJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    throw new InvalidToken();
  }

  c.set("userId", payload.userId);
  c.set("email", payload.email);
  await next();
}

export function generateStateParam(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
