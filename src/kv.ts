// Typed helpers over the single KV namespace. Centralizing the key schema here
// keeps the rest of the Worker from hand-rolling key strings.

import { STARTING_COINS } from "./catalog";

export interface Env {
  GAME_KV: KVNamespace;
  ASSETS: Fetcher;
}

export interface UserRecord {
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
}

export interface ScoreRecord {
  high: number;
  updatedAt: number;
}

export interface Inventory {
  coins: number;
  items: Record<string, number>; // itemId -> quantity owned
  equipped: { snake?: string; food?: string; board?: string };
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const keys = {
  user: (username: string) => `user:${username.toLowerCase()}`,
  session: (token: string) => `session:${token}`,
  score: (username: string) => `score:${username.toLowerCase()}`,
  friends: (username: string) => `friends:${username.toLowerCase()}`,
  inventory: (username: string) => `inventory:${username.toLowerCase()}`,
};

export async function getUser(env: Env, username: string): Promise<UserRecord | null> {
  return env.GAME_KV.get<UserRecord>(keys.user(username), "json");
}

export async function putUser(env: Env, user: UserRecord): Promise<void> {
  await env.GAME_KV.put(keys.user(user.username), JSON.stringify(user));
}

export async function createSession(env: Env, token: string, username: string): Promise<void> {
  await env.GAME_KV.put(keys.session(token), username.toLowerCase(), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
}

export async function getSessionUser(env: Env, token: string): Promise<string | null> {
  return env.GAME_KV.get(keys.session(token), "text");
}

export async function deleteSession(env: Env, token: string): Promise<void> {
  await env.GAME_KV.delete(keys.session(token));
}

export async function getScore(env: Env, username: string): Promise<ScoreRecord | null> {
  return env.GAME_KV.get<ScoreRecord>(keys.score(username), "json");
}

export async function putScore(env: Env, username: string, score: ScoreRecord): Promise<void> {
  await env.GAME_KV.put(keys.score(username), JSON.stringify(score));
}

export async function getInventory(env: Env, username: string): Promise<Inventory> {
  const inv = await env.GAME_KV.get<Inventory>(keys.inventory(username), "json");
  return {
    coins: inv?.coins ?? STARTING_COINS,
    items: inv?.items ?? {},
    equipped: inv?.equipped ?? {},
  };
}

export async function putInventory(env: Env, username: string, inv: Inventory): Promise<void> {
  await env.GAME_KV.put(keys.inventory(username), JSON.stringify(inv));
}

export async function getFriends(env: Env, username: string): Promise<string[]> {
  const list = await env.GAME_KV.get<string[]>(keys.friends(username), "json");
  return list ?? [];
}

export async function putFriends(env: Env, username: string, friends: string[]): Promise<void> {
  await env.GAME_KV.put(keys.friends(username), JSON.stringify(friends));
}
