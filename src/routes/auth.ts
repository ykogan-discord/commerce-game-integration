import { Hono } from "hono";
import type { AppEnv } from "../auth";
import {
  endSession,
  hashPassword,
  requireAuth,
  startSession,
  verifyPassword,
} from "../auth";
import { getUser, putUser } from "../kv";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 6;

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/register", async (c) => {
  const { username, password } = await c.req.json().catch(() => ({}));

  if (typeof username !== "string" || !USERNAME_RE.test(username)) {
    return c.json({ error: "Username must be 3-20 letters, numbers, or underscores." }, 400);
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return c.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, 400);
  }
  if (await getUser(c.env, username)) {
    return c.json({ error: "That username is taken." }, 409);
  }

  const { hash, salt } = await hashPassword(password);
  await putUser(c.env, { username, passwordHash: hash, salt, createdAt: Date.now() });
  await startSession(c, username);
  return c.json({ username });
});

authRoutes.post("/login", async (c) => {
  const { username, password } = await c.req.json().catch(() => ({}));

  if (typeof username !== "string" || typeof password !== "string") {
    return c.json({ error: "Missing username or password." }, 400);
  }
  const user = await getUser(c.env, username);
  if (!user || !(await verifyPassword(password, user.salt, user.passwordHash))) {
    return c.json({ error: "Invalid username or password." }, 401);
  }

  await startSession(c, user.username);
  return c.json({ username: user.username });
});

authRoutes.post("/logout", async (c) => {
  await endSession(c);
  return c.json({ ok: true });
});

// Cheap auth probe used by the frontend to decide whether to show the login gate.
authRoutes.get("/me", requireAuth, (c) => {
  return c.json({ username: c.get("username") });
});
