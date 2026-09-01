import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  createSession,
  deleteSession,
  getSessionUser,
  type Env,
} from "./kv";

// Hono app is typed with these bindings + per-request variables.
export type AppEnv = {
  Bindings: Env;
  Variables: { username: string };
};

const COOKIE_NAME = "session";
const PBKDF2_ITERATIONS = 100_000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

// PBKDF2-SHA256 via Web Crypto — runs identically on localhost and the edge.
async function derive(password: string, saltHex: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: fromHex(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return toHex(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomHex(16);
  const hash = await derive(password, salt);
  return { hash, salt };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  expectedHash: string,
): Promise<boolean> {
  const hash = await derive(password, saltHex);
  return constantTimeEqual(hash, expectedHash);
}

function isSecure(c: Context): boolean {
  return new URL(c.req.url).protocol === "https:";
}

export async function startSession(c: Context<AppEnv>, username: string): Promise<void> {
  const token = randomHex(24);
  await createSession(c.env, token, username);
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isSecure(c),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function endSession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, COOKIE_NAME);
  if (token) {
    await deleteSession(c.env, token);
  }
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

// Guards protected routes. On success, c.get('username') is the logged-in user.
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, COOKIE_NAME);
  const username = token ? await getSessionUser(c.env, token) : null;
  if (!username) {
    return c.json({ error: "unauthorized" }, 401);
  }
  c.set("username", username);
  await next();
};
