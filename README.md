# Commerce Game Integration

A mock video game (Snake 🐍) wired up as a base for playtesting our **Discord Commerce** integration.
It runs entirely on **Cloudflare Workers + KV** — locally via `wrangler dev` (with an on-disk KV replica that
survives restarts) and deployable with a single `wrangler deploy`.

## Sections

1. **Game** — Forced login (lightweight local accounts) and a Snake game with a per-user high score. A **burger
   menu** (top-left) opens a drawer with three panels:
   - **Leaderboard** — you + friends, ranked by high score (add friends by username).
   - **Store** — 15 buyable items backed by a coin wallet (everyone starts with 1000 🪙). 13 one-time **skins**
     (snake colors incl. a Rainbow, food colors, board themes) and 2 repeat-buyable **consumables** (Extra Life,
     Slow-Mo Potion). No checkout — clicking Buy just asks to confirm. All purchases persist to KV.
   - **Inventory** — equip owned skins (which actually recolor the game), **return** one-time items for a refund,
     and arm the Slow-Mo Potion. Extra Lives are consumed when you survive a crash.

   There's also a **Dvorak toggle** under the board: movement is WASD on QWERTY, or `, a o e` on Dvorak (arrow keys
   work in both). The preference is saved in `localStorage`.
2. **Storefront** — Intentionally empty. Placeholder for managing custom SKUs / storefront pages via the
   commerce API.
3. **Commerce** — A scaffold for purchase / entitlement debugging + analytics (entitlement inspector, fulfillment
   debug log, analytics). **No backend is wired up** — building it out is the exercise for the reader.

## Stack

- **Hono** on Cloudflare Workers (`src/`, TypeScript) serves `/api/*`.
- **Cloudflare KV** is the only datastore (users, sessions, scores, friends, inventory). See the key schema in
  `src/kv.ts`. The store catalog lives in `src/catalog.ts` and is served to the client via `GET /api/store/catalog`.
- Vanilla HTML/CSS/JS frontend in `public/` (no build step), served by the Workers Assets runtime.
- Auth is local username + password (PBKDF2 via Web Crypto) with a cookie session. `src/auth.ts` is the seam where
  Discord OAuth would slot in later.

## Run locally

```bash
npm install
npm run dev
```

`wrangler dev` serves the app (default http://localhost:8787) and provisions a **local KV namespace** persisted
under `.wrangler/state`, so accounts, scores, and friends survive restarts. No Cloudflare account or SKU/app
credentials are needed to run locally.

Other scripts:

```bash
npm run typecheck   # tsc --noEmit
```

## Deploy to Cloudflare

1. Create a real KV namespace and copy the returned `id`:

   ```bash
   npm run kv:create
   ```

2. Paste that `id` into `wrangler.jsonc` under `kv_namespaces` (replace the placeholder).
3. Deploy:

   ```bash
   npm run deploy
   ```

## Project layout

```
wrangler.jsonc         KV + assets bindings, deploy config
src/
  index.ts             Hono app: mounts /api routes, delegates the rest to static assets
  kv.ts                KV key schema + typed helpers (users, sessions, scores, friends, inventory)
  catalog.ts           the 15-item store catalog (single source of truth)
  auth.ts              password hashing, cookie sessions, requireAuth middleware
  routes/auth.ts       register / login / logout / me
  routes/game.ts       get / submit high score
  routes/friends.ts    add / remove friend, leaderboard
  routes/store.ts      catalog / inventory / buy / return / equip / unequip / consume
public/
  index.html           login gate + 3-tab shell + burger drawer + confirm modal
  styles.css
  app.js               auth flow, hash-router, game wiring, leaderboard, drawer, Dvorak, modal
  snake.js             the canvas game (skins, lives, slow-mo, keymaps)
  store.js             store + inventory panels; exposes equipped/consumable state to the game
  commerce.js          tab 3 static scaffold
```

## Where to build next

- **Tab 3**: wire the inspector to the commerce API's entitlements read, the debug log to fulfillment/revocation
  events, and derive analytics from entitlement history.
- **Tab 2**: CRUD for custom SKUs + storefront pages against the commerce API.
- **Auth**: swap local accounts for Discord OAuth so the account's `user_id` matches the entitlement owner.
- **Game ↔ commerce**: grant real in-game rewards (skins, extra lives) by fulfilling entitlements.
