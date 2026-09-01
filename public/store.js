// Store + inventory: talks to /api/store/*, renders the drawer's Store and
// Inventory panels, and exposes the equipped/consumable state to the game.
(function () {
  const $ = (sel) => document.querySelector(sel);
  const SLOWMO_ARMED_KEY = "snake:slowmo-armed";

  let catalog = [];
  let byId = {};
  let inv = { coins: 0, items: {}, equipped: {} };

  async function api(path, method = "GET", body) {
    const res = await fetch(`/api/store${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      /* no body */
    }
    return { ok: res.ok, status: res.status, data };
  }

  function isSlowMoArmed() {
    return localStorage.getItem(SLOWMO_ARMED_KEY) === "1" && (inv.items["slow-mo"] || 0) > 0;
  }

  function setSlowMoArmed(on) {
    if (on) {
      localStorage.setItem(SLOWMO_ARMED_KEY, "1");
    } else {
      localStorage.removeItem(SLOWMO_ARMED_KEY);
    }
  }

  // Equipped skins + owned consumables → the shape snake.js expects.
  function getConfig() {
    const eq = inv.equipped || {};
    const snakeItem = eq.snake ? byId[eq.snake] : null;
    const foodItem = eq.food ? byId[eq.food] : null;
    const boardItem = eq.board ? byId[eq.board] : null;
    return {
      snakeColor: snakeItem && snakeItem.value !== "rainbow" ? snakeItem.value : null,
      rainbow: !!(snakeItem && snakeItem.value === "rainbow"),
      foodColor: foodItem ? foodItem.value : null,
      boardColor: boardItem ? boardItem.value : null,
      extraLives: inv.items["extra-life"] || 0,
      slowMoOwned: inv.items["slow-mo"] || 0,
    };
  }

  function renderCoins() {
    $("#coins").textContent = inv.coins;
  }

  function renderStore() {
    const grid = $("#store-grid");
    grid.innerHTML = catalog
      .map((item) => {
        const owned = inv.items[item.id] || 0;
        const soldOut = item.oneTime && owned > 0;
        const badge = item.oneTime ? "Skin" : "Consumable";
        const ownedNote = !item.oneTime && owned > 0 ? ` · owned ${owned}` : "";
        const button = soldOut
          ? `<button class="owned" disabled>Owned</button>`
          : `<button data-buy="${item.id}">Buy</button>`;
        return `
          <div class="store-card">
            <span class="item-emoji">${item.emoji}</span>
            <span class="item-name">${item.name} <span class="item-badge">${badge}</span></span>
            <span class="item-desc">${item.description}${ownedNote}</span>
            <div class="item-foot">
              <span class="item-price">🪙 ${item.price}</span>
              ${button}
            </div>
          </div>`;
      })
      .join("");
  }

  function cosmeticRow(item) {
    const slot = item.category;
    const isEquipped = inv.equipped[slot] === item.id;
    const equipBtn = isEquipped
      ? `<button class="ghost" disabled>Equipped</button>`
      : `<button class="ghost" data-equip="${item.id}">Equip</button>`;
    return `
      <div class="inv-row ${isEquipped ? "equipped" : ""}">
        <span class="item-emoji">${item.emoji}</span>
        <span class="inv-name">${item.name}</span>
        <div class="inv-actions">
          ${equipBtn}
          <button class="ghost" data-return="${item.id}">Return</button>
        </div>
      </div>`;
  }

  function consumableRow(item) {
    const qty = inv.items[item.id] || 0;
    let action = `<span class="inv-qty">used on crash</span>`;
    if (item.id === "slow-mo") {
      const armed = isSlowMoArmed();
      action = `<button class="ghost ${armed ? "armed" : ""}" data-arm="${item.id}">${
        armed ? "Armed ✓" : "Arm"
      }</button>`;
    }
    return `
      <div class="inv-row">
        <span class="item-emoji">${item.emoji}</span>
        <span class="inv-name">${item.name}</span>
        <span class="inv-qty">×${qty}</span>
        <div class="inv-actions">${action}</div>
      </div>`;
  }

  function renderInventory() {
    const list = $("#inventory-list");
    const owned = catalog.filter((i) => (inv.items[i.id] || 0) > 0);
    if (owned.length === 0) {
      list.innerHTML = `<div class="inv-empty">Nothing owned yet — visit the Store.</div>`;
      return;
    }

    const skins = owned.filter((i) => i.category !== "consumable");
    const consumables = owned.filter((i) => i.category === "consumable");

    let html = "";
    if (skins.length) {
      html += `<div class="inv-group-label">Skins</div>`;
      html += skins.map(cosmeticRow).join("");
    }
    if (consumables.length) {
      html += `<div class="inv-group-label">Consumables</div>`;
      html += consumables.map(consumableRow).join("");
    }
    list.innerHTML = html;
  }

  function renderAll() {
    renderCoins();
    renderStore();
    renderInventory();
    // Reflect equipped skins on the idle board; app.js re-configures at start.
    if (window.Snake && !window.Snake.isRunning()) {
      window.Snake.configure(getConfig());
    }
  }

  async function refresh() {
    if (catalog.length === 0) {
      const c = await api("/catalog");
      if (c.ok && c.data) {
        catalog = c.data.catalog;
        byId = Object.fromEntries(catalog.map((i) => [i.id, i]));
      }
    }
    const r = await api("/inventory");
    if (r.ok && r.data) {
      inv = r.data;
      renderAll();
    }
    return inv;
  }

  async function buy(itemId) {
    const item = byId[itemId];
    if (!item) {
      return;
    }
    const ok = await window.confirmDialog(`Buy ${item.emoji} ${item.name} for 🪙 ${item.price}?`);
    if (!ok) {
      return;
    }
    const r = await api("/buy", "POST", { itemId });
    if (r.ok) {
      inv = r.data;
      renderAll();
    } else {
      window.toast && window.toast((r.data && r.data.error) || "Purchase failed.");
    }
  }

  async function returnItem(itemId) {
    const item = byId[itemId];
    if (!item) {
      return;
    }
    const ok = await window.confirmDialog(
      `Return ${item.emoji} ${item.name} for a 🪙 ${item.price} refund?`,
    );
    if (!ok) {
      return;
    }
    const r = await api("/return", "POST", { itemId });
    if (r.ok) {
      inv = r.data;
      renderAll();
    } else {
      window.toast && window.toast((r.data && r.data.error) || "Return failed.");
    }
  }

  async function equip(itemId) {
    const r = await api("/equip", "POST", { itemId });
    if (r.ok) {
      inv = r.data;
      renderAll();
    }
  }

  // Consume one Extra Life (called by the game when a crash is survived).
  async function consumeLife() {
    const r = await api("/consume", "POST", { itemId: "extra-life" });
    if (r.ok) {
      inv = r.data;
      renderCoins();
      renderInventory();
      return true;
    }
    return false;
  }

  // Consume one Slow-Mo Potion (called at start when armed) and disarm it.
  async function consumeSlowMo() {
    const r = await api("/consume", "POST", { itemId: "slow-mo" });
    setSlowMoArmed(false);
    if (r.ok) {
      inv = r.data;
      renderAll();
      return true;
    }
    return false;
  }

  function initDelegation() {
    $("#store-grid").addEventListener("click", (e) => {
      const buyBtn = e.target.closest("[data-buy]");
      if (buyBtn) {
        buy(buyBtn.dataset.buy);
      }
    });
    $("#inventory-list").addEventListener("click", (e) => {
      const equipBtn = e.target.closest("[data-equip]");
      const returnBtn = e.target.closest("[data-return]");
      const armBtn = e.target.closest("[data-arm]");
      if (equipBtn) {
        equip(equipBtn.dataset.equip);
      } else if (returnBtn) {
        returnItem(returnBtn.dataset.return);
      } else if (armBtn) {
        setSlowMoArmed(!isSlowMoArmed());
        renderInventory();
      }
    });
  }

  initDelegation();

  window.Store = { refresh, getConfig, consumeLife, consumeSlowMo, isSlowMoArmed };
})();
