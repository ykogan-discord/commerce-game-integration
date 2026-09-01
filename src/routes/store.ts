import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../auth";
import { requireAuth } from "../auth";
import { getInventory, putInventory, type Inventory } from "../kv";
import { CATALOG, CATALOG_BY_ID, type CatalogItem } from "../catalog";

export const storeRoutes = new Hono<AppEnv>();

// Catalog is static and identity-agnostic, but keep it behind auth for parity
// with the rest of the game API.
storeRoutes.use("*", requireAuth);

storeRoutes.get("/catalog", (c) => {
  return c.json({ catalog: CATALOG });
});

storeRoutes.get("/inventory", async (c) => {
  return c.json(await getInventory(c.env, c.get("username")));
});

function slotFor(item: CatalogItem): "snake" | "food" | "board" | null {
  if (item.category === "snake" || item.category === "food" || item.category === "board") {
    return item.category;
  }
  return null;
}

async function readItem(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const itemId = typeof body.itemId === "string" ? body.itemId : null;
  const item = itemId ? CATALOG_BY_ID[itemId] : undefined;
  return { itemId, item };
}

storeRoutes.post("/buy", async (c) => {
  const username = c.get("username");
  const { item } = await readItem(c);
  if (!item) {
    return c.json({ error: "Unknown item." }, 404);
  }

  const inv = await getInventory(c.env, username);
  const owned = inv.items[item.id] ?? 0;

  if (item.oneTime && owned > 0) {
    return c.json({ error: "You already own this." }, 409);
  }
  if (inv.coins < item.price) {
    return c.json({ error: "Not enough coins." }, 400);
  }

  inv.coins -= item.price;
  inv.items[item.id] = owned + 1;

  // Auto-equip a freshly bought cosmetic so the purchase is immediately visible.
  const slot = slotFor(item);
  if (slot) {
    inv.equipped[slot] = item.id;
  }

  await putInventory(c.env, username, inv);
  return c.json(inv);
});

storeRoutes.post("/return", async (c) => {
  const username = c.get("username");
  const { item } = await readItem(c);
  if (!item) {
    return c.json({ error: "Unknown item." }, 404);
  }
  if (!item.oneTime) {
    return c.json({ error: "Consumables can't be returned." }, 400);
  }

  const inv = await getInventory(c.env, username);
  if ((inv.items[item.id] ?? 0) < 1) {
    return c.json({ error: "You don't own this." }, 400);
  }

  delete inv.items[item.id];
  inv.coins += item.price;

  const slot = slotFor(item);
  if (slot && inv.equipped[slot] === item.id) {
    delete inv.equipped[slot];
  }

  await putInventory(c.env, username, inv);
  return c.json(inv);
});

storeRoutes.post("/equip", async (c) => {
  const username = c.get("username");
  const { item } = await readItem(c);
  const slot = item ? slotFor(item) : null;
  if (!item || !slot) {
    return c.json({ error: "Not an equippable item." }, 400);
  }

  const inv = await getInventory(c.env, username);
  if ((inv.items[item.id] ?? 0) < 1) {
    return c.json({ error: "You don't own this." }, 400);
  }

  inv.equipped[slot] = item.id;
  await putInventory(c.env, username, inv);
  return c.json(inv);
});

storeRoutes.post("/unequip", async (c) => {
  const username = c.get("username");
  const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const slot = body.slot;
  if (slot !== "snake" && slot !== "food" && slot !== "board") {
    return c.json({ error: "Invalid slot." }, 400);
  }

  const inv = await getInventory(c.env, username);
  delete inv.equipped[slot as keyof Inventory["equipped"]];
  await putInventory(c.env, username, inv);
  return c.json(inv);
});

// Decrement a consumable by one (extra-life spent on death, slow-mo spent on start).
storeRoutes.post("/consume", async (c) => {
  const username = c.get("username");
  const { item } = await readItem(c);
  if (!item || item.oneTime) {
    return c.json({ error: "Not a consumable." }, 400);
  }

  const inv = await getInventory(c.env, username);
  const owned = inv.items[item.id] ?? 0;
  if (owned < 1) {
    return c.json({ error: "None to consume." }, 400);
  }

  if (owned - 1 <= 0) {
    delete inv.items[item.id];
  } else {
    inv.items[item.id] = owned - 1;
  }

  await putInventory(c.env, username, inv);
  return c.json(inv);
});
