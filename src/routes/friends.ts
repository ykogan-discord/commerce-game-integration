import { Hono } from "hono";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { getFriends, getScore, getUser, putFriends } from "../kv";

export const friendRoutes = new Hono<AppEnv>();

friendRoutes.use("*", requireAuth);

// Leaderboard = the current user plus their friends, ranked by high score.
friendRoutes.get("/", async (c) => {
  const me = c.get("username");
  const friends = await getFriends(c.env, me);
  const usernames = [me, ...friends];

  const rows = await Promise.all(
    usernames.map(async (username) => {
      const score = await getScore(c.env, username);
      return { username, high: score?.high ?? 0, isSelf: username.toLowerCase() === me.toLowerCase() };
    }),
  );
  rows.sort((a, b) => b.high - a.high);
  return c.json({ leaderboard: rows });
});

friendRoutes.post("/", async (c) => {
  const me = c.get("username");
  const { username } = await c.req.json().catch(() => ({}));

  if (typeof username !== "string" || !username.trim()) {
    return c.json({ error: "Provide a username to add." }, 400);
  }
  if (username.toLowerCase() === me.toLowerCase()) {
    return c.json({ error: "You can't add yourself." }, 400);
  }

  const target = await getUser(c.env, username);
  if (!target) {
    return c.json({ error: "No such user." }, 404);
  }

  const friends = await getFriends(c.env, me);
  if (friends.some((f) => f.toLowerCase() === target.username.toLowerCase())) {
    return c.json({ error: "Already friends." }, 409);
  }

  friends.push(target.username);
  await putFriends(c.env, me, friends);
  return c.json({ ok: true, friend: target.username });
});

friendRoutes.delete("/:username", async (c) => {
  const me = c.get("username");
  const toRemove = c.req.param("username").toLowerCase();
  const friends = await getFriends(c.env, me);
  const next = friends.filter((f) => f.toLowerCase() !== toRemove);
  await putFriends(c.env, me, next);
  return c.json({ ok: true });
});
