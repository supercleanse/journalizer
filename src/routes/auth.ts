import { Hono } from "hono";
import type { AppContext } from "../types/env";
import { createDb } from "../db/index";
import { getUserByGoogleId, createUser, updateUser, getUserById } from "../db/queries";
import {
  createSessionJWT,
  verifySessionJWT,
  setSessionCookie,
  clearSessionCookie,
  generateStateParam,
  authMiddleware,
} from "../lib/auth";
import { getCookie } from "hono/cookie";
import { InvalidState, TokenExchangeFailed, UserCreationFailed } from "../lib/errors";

const auth = new Hono<AppContext>();

// GET /auth/google — redirect to Google consent screen
auth.get("/google", async (c) => {
  const state = generateStateParam();

  await c.env.KV.put(`oauth_state:${state}`, "1", { expirationTtl: 300 });

  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${new URL(c.req.url).origin}/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "consent",
  });

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /auth/callback — exchange code for tokens, create/update user, set session
auth.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state) {
    return c.json({ error: "Missing code or state parameter" }, 400);
  }

  // Validate CSRF state
  const storedState = await c.env.KV.get(`oauth_state:${state}`);
  if (!storedState) {
    throw new InvalidState();
  }
  await c.env.KV.delete(`oauth_state:${state}`);

  // Exchange code for tokens
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${new URL(c.req.url).origin}/auth/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    throw new TokenExchangeFailed();
  }

  const tokens = (await tokenResponse.json()) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
  };

  if (!tokens.id_token) {
    throw new TokenExchangeFailed("No ID token received from Google");
  }

  // Decode ID token (Google's tokens are JWTs)
  const parts = tokens.id_token.split(".");
  if (parts.length !== 3) {
    throw new TokenExchangeFailed("Invalid ID token format");
  }

  // Base64url decode with proper padding and UTF-8 handling
  let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  const jsonStr = new TextDecoder().decode(
    Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
  );

  const payload = JSON.parse(jsonStr) as {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
    iss?: string;
    aud?: string;
    exp?: number;
  };

  // Validate basic ID token claims
  if (
    (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") ||
    payload.aud !== c.env.GOOGLE_CLIENT_ID ||
    (payload.exp && payload.exp < Math.floor(Date.now() / 1000))
  ) {
    throw new TokenExchangeFailed("ID token validation failed");
  }

  const db = createDb(c.env.DB);

  // Create or update user
  let user = await getUserByGoogleId(db, payload.sub);

  if (user) {
    user = await updateUser(db, user.id, {
      displayName: payload.name ?? user.displayName ?? undefined,
      avatarUrl: payload.picture ?? user.avatarUrl ?? undefined,
    });
  } else {
    user = await createUser(db, {
      id: crypto.randomUUID(),
      googleId: payload.sub,
      email: payload.email,
      displayName: payload.name,
      avatarUrl: payload.picture,
    });
  }

  if (!user) {
    throw new UserCreationFailed();
  }

  // Store refresh token in KV
  if (tokens.refresh_token) {
    await c.env.KV.put(`refresh:${user.id}`, tokens.refresh_token, {
      expirationTtl: 604800, // 7 days
    });
  }

  // Create session JWT and set cookie
  const sessionToken = await createSessionJWT(
    { userId: user.id, email: user.email },
    c.env.JWT_SECRET
  );
  setSessionCookie(c, sessionToken);

  // Redirect to dashboard
  return c.redirect("/");
});

// POST /auth/logout — clear session
auth.post("/logout", async (c) => {
  const token = getCookie(c, "session");
  if (token) {
    const payload = await verifySessionJWT(token, c.env.JWT_SECRET);
    if (payload) {
      await c.env.KV.delete(`refresh:${payload.userId}`);
    }
  }

  clearSessionCookie(c);
  return c.json({ success: true, message: "Logged out" });
});

// GET /auth/me — return current user info (requires auth)
auth.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const user = await getUserById(db, userId);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    phoneVerified: user.phoneVerified === 1,
    voiceStyle: user.voiceStyle,
    createdAt: user.createdAt,
  });
});

export default auth;
