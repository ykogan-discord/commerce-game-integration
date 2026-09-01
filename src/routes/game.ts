import { Hono } from "hono";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { getScore, putScore } from "../kv";

export const gameRoutes = new Hono<AppEnv>();

gameRoutes.use("*", requireAuth);

gameRoutes.get("/score", async (c) => {
  const score = await getScore(c.env, c.get("username"));
  return c.json({ high: score?.high ?? 0 });
});

// Only overwrites when the submitted run beats the stored high score.
gameRoutes.post("/score", async (c) => {
  const { score } = await c.req.json().catch(() => ({}));
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
    return c.json({ error: "Invalid score." }, 400);
  }

  const username = c.get("username");
  const current = await getScore(c.env, username);
  const high = Math.max(Math.floor(score), current?.high ?? 0);
  if (high !== current?.high) {
    await putScore(c.env, username, { high, updatedAt: Date.now() });
  }
  return c.json({ high, isNewHigh: high === Math.floor(score) && high !== (current?.high ?? 0) });
});
