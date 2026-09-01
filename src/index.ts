import { Hono } from "hono";
import type { AppEnv } from "./auth";
import { authRoutes } from "./routes/auth";
import { gameRoutes } from "./routes/game";
import { friendRoutes } from "./routes/friends";
import { storeRoutes } from "./routes/store";

const app = new Hono<AppEnv>();

const api = new Hono<AppEnv>();
api.route("/auth", authRoutes);
api.route("/game", gameRoutes);
api.route("/friends", friendRoutes);
api.route("/store", storeRoutes);

app.route("/api", api);

app.notFound((c) => {
  // Any non-API path is a static asset request. `run_worker_first: ["/api/*"]`
  // means the Worker only sees /api/* first, but this keeps direct hits safe.
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
