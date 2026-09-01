// The store catalog. Single source of truth — the frontend fetches this via
// GET /api/store/catalog so item defs never drift between client and server.
//
// Cosmetic items (snake/food/board) are one-time "skins": buy once, equippable,
// returnable. Consumables are repeat-buyable and consumed by gameplay.

export type ItemCategory = "snake" | "food" | "board" | "consumable";

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  oneTime: boolean;
  price: number;
  emoji: string;
  // Cosmetics: a CSS color. Consumables: an effect key ("extra-life" | "slow-mo").
  value: string;
}

export const STARTING_COINS = 1000;

export const CATALOG: CatalogItem[] = [
  // ---- Snake skins (one-time) ----
  { id: "snake-lime", name: "Lime Viper", description: "A zesty lime-green serpent.", category: "snake", oneTime: true, price: 100, emoji: "🟢", value: "#7be04b" },
  { id: "snake-sunset", name: "Sunset Boa", description: "Warm sunset orange scales.", category: "snake", oneTime: true, price: 120, emoji: "🟠", value: "#f2913b" },
  { id: "snake-amethyst", name: "Amethyst Adder", description: "Deep royal purple.", category: "snake", oneTime: true, price: 150, emoji: "🟣", value: "#a855f7" },
  { id: "snake-crimson", name: "Crimson Cobra", description: "Danger-red and bold.", category: "snake", oneTime: true, price: 150, emoji: "🔴", value: "#ed4245" },
  { id: "snake-gold", name: "Golden Python", description: "Shimmering gold for high rollers.", category: "snake", oneTime: true, price: 250, emoji: "🟡", value: "#f5c542" },
  { id: "snake-cyan", name: "Cyan Mamba", description: "Electric neon cyan.", category: "snake", oneTime: true, price: 150, emoji: "🔵", value: "#22d3ee" },
  { id: "snake-bubblegum", name: "Bubblegum Racer", description: "Sweet bubblegum pink.", category: "snake", oneTime: true, price: 120, emoji: "🩷", value: "#f472b6" },
  { id: "snake-rainbow", name: "Rainbow Serpent", description: "A shifting rainbow along every segment.", category: "snake", oneTime: true, price: 400, emoji: "🌈", value: "rainbow" },

  // ---- Food skins (one-time) ----
  { id: "food-gold", name: "Golden Apple", description: "Recolors the food gold.", category: "food", oneTime: true, price: 90, emoji: "🍏", value: "#f5c542" },
  { id: "food-blueberry", name: "Blueberry", description: "Recolors the food blue.", category: "food", oneTime: true, price: 90, emoji: "🫐", value: "#60a5fa" },

  // ---- Board themes (one-time) ----
  { id: "board-midnight", name: "Midnight Board", description: "An inky midnight play field.", category: "board", oneTime: true, price: 110, emoji: "🌑", value: "#0f1117" },
  { id: "board-retro", name: "Retro Green Board", description: "Old-school phosphor green.", category: "board", oneTime: true, price: 110, emoji: "🟩", value: "#0b3d2e" },
  { id: "board-slate", name: "Slate Board", description: "Cool neutral slate.", category: "board", oneTime: true, price: 110, emoji: "⬛", value: "#2f3136" },

  // ---- Consumables (repeat-buyable) ----
  { id: "extra-life", name: "Extra Life", description: "Survive one crash. Consumed on death.", category: "consumable", oneTime: false, price: 60, emoji: "❤️", value: "extra-life" },
  { id: "slow-mo", name: "Slow-Mo Potion", description: "Arm it, then your next run runs slower.", category: "consumable", oneTime: false, price: 50, emoji: "🐢", value: "slow-mo" },
];

export const CATALOG_BY_ID: Record<string, CatalogItem> = Object.fromEntries(
  CATALOG.map((item) => [item.id, item]),
);
