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

/**
 * Determine user role based on ADMIN_EMAILS environment variable.
 */
export function determineRole(email: string, adminEmails?: string): "user" | "admin" {
  if (!adminEmails) return "user";
  const admins = adminEmails.split(",").map((e) => e.trim().toLowerCase());
  return admins.includes(email.toLowerCase()) ? "admin" : "user";
}

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
    access_token?: string;
    refresh_token?: string;
  };

  if (!tokens.access_token) {
    throw new TokenExchangeFailed("No access token received from Google");
  }

  // Use Google's userinfo endpoint for verified user data
  // This avoids needing to cryptographically verify the JWT ourselves
  const userinfoResponse = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );

  if (!userinfoResponse.ok) {
    throw new TokenExchangeFailed("Failed to fetch user info from Google");
  }

  const payload = (await userinfoResponse.json()) as {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  };

  const db = createDb(c.env.DB);

  // Create or update user
  const role = determineRole(payload.email, c.env.ADMIN_EMAILS);
  let user = await getUserByGoogleId(db, payload.sub);

  if (user) {
    user = await updateUser(db, user.id, {
      displayName: payload.name ?? user.displayName ?? undefined,
      avatarUrl: payload.picture ?? user.avatarUrl ?? undefined,
      role,
    });
  } else {
    user = await createUser(db, {
      id: crypto.randomUUID(),
      googleId: payload.sub,
      email: payload.email,
      displayName: payload.name,
      avatarUrl: payload.picture,
      role,
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
    telegramLinked: !!user.telegramChatId,
    voiceStyle: user.voiceStyle,
    role: user.role,
    createdAt: user.createdAt,
  });
});

export default auth;
