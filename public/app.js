// App glue: auth gate, tab routing, game wiring, and the friends leaderboard.
(function () {
  const $ = (sel) => document.querySelector(sel);

  async function api(path, method = "GET", body) {
    const res = await fetch(`/api${path}`, {
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

  // ===== Auth gate =====
  let authMode = "login"; // or "register"

  function renderAuthMode() {
    $("#auth-submit").textContent = authMode === "login" ? "Log in" : "Create account";
    $("#auth-toggle-text").textContent = authMode === "login" ? "No account?" : "Have an account?";
    $("#auth-toggle-link").textContent = authMode === "login" ? "Register" : "Log in";
    $("#auth-password").setAttribute(
      "autocomplete",
      authMode === "login" ? "current-password" : "new-password",
    );
    $("#auth-error").textContent = "";
  }

  function showGate() {
    $("#auth-gate").classList.remove("hidden");
    $("#app").classList.add("hidden");
  }

  async function showApp(username) {
    $("#auth-gate").classList.add("hidden");
    $("#app").classList.remove("hidden");
    $("#user-name").textContent = username;
    await Promise.all([
      loadBest(),
      loadLeaderboard(),
      window.Store ? window.Store.refresh() : Promise.resolve(),
    ]);
    route();
  }

  function initAuth() {
    renderAuthMode();

    $("#auth-toggle-link").addEventListener("click", (e) => {
      e.preventDefault();
      authMode = authMode === "login" ? "register" : "login";
      renderAuthMode();
    });

    $("#auth-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = $("#auth-username").value.trim();
      const password = $("#auth-password").value;
      const { ok, data } = await api(`/auth/${authMode}`, "POST", { username, password });
      if (ok) {
        $("#auth-password").value = "";
        showApp(data.username);
      } else {
        $("#auth-error").textContent = (data && data.error) || "Something went wrong.";
      }
    });

    $("#logout-btn").addEventListener("click", async () => {
      await api("/auth/logout", "POST");
      showGate();
    });
  }

  // ===== Tab routing =====
  function route() {
    const hash = location.hash || "#/game";
    const name = hash.replace("#/", "") || "game";
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === name);
    });
    document.querySelectorAll(".view").forEach((v) => {
      v.classList.toggle("active", v.dataset.view === name);
    });
    if (name === "commerce") {
      window.renderCommerce($("#commerce-root"));
    }
  }

  // ===== Game =====
  function setOverlay(title, sub, visible, btnLabel) {
    $("#overlay-title").textContent = title;
    $("#overlay-sub").textContent = sub;
    if (btnLabel) {
      $("#overlay-btn").textContent = btnLabel;
    }
    $("#game-overlay").classList.toggle("hidden", !visible);
  }

  function updateLivesHud(n) {
    $("#lives").textContent = n;
    $("#lives-hud").classList.toggle("hidden", n <= 0);
  }

  async function loadBest() {
    const { ok, data } = await api("/game/score");
    if (ok) {
      $("#best").textContent = data.high;
    }
  }

  // Applies equipped skins + consumables from the store, then starts a run.
  async function startGame() {
    if (window.Snake.isRunning()) {
      return;
    }
    const cfg = (window.Store && window.Store.getConfig()) || {};
    let slowMo = false;
    if (window.Store && window.Store.isSlowMoArmed()) {
      slowMo = await window.Store.consumeSlowMo();
    }
    window.Snake.configure({
      snakeColor: cfg.snakeColor,
      rainbow: cfg.rainbow,
      foodColor: cfg.foodColor,
      boardColor: cfg.boardColor,
      extraLives: cfg.extraLives || 0,
      slowMo,
    });
    updateLivesHud(cfg.extraLives || 0);
    window.Snake.start();
  }

  function initGame() {
    const canvas = $("#board");
    window.Snake.mount(canvas, {
      onStart: () => setOverlay("", "", false),
      onScore: (s) => {
        $("#score").textContent = s;
      },
      onLifeLost: (remaining) => {
        updateLivesHud(remaining);
        if (window.Store) {
          window.Store.consumeLife();
        }
      },
      onGameOver: async (finalScore) => {
        updateLivesHud(0);
        const { ok, data } = await api("/game/score", "POST", { score: finalScore });
        const best = ok ? data.high : Number($("#best").textContent);
        $("#best").textContent = best;
        const beat = ok && data.isNewHigh;
        setOverlay(
          beat ? "New best! 🎉" : "Game over",
          beat ? `You scored ${finalScore} — a new personal best!` : `You scored ${finalScore}.`,
          true,
          "Play again",
        );
        loadLeaderboard();
      },
    });

    $("#game-overlay").addEventListener("click", startGame);
  }

  // ===== Friends / leaderboard =====
  async function loadLeaderboard() {
    const { ok, data } = await api("/friends");
    if (!ok) {
      return;
    }
    const list = $("#leaderboard");
    list.innerHTML = "";
    data.leaderboard.forEach((row, i) => {
      const li = document.createElement("li");
      if (row.isSelf) {
        li.classList.add("self");
      }
      const remove = row.isSelf
        ? ""
        : `<button class="lb-remove" data-remove="${row.username}" title="Remove friend">×</button>`;
      li.innerHTML =
        `<span class="lb-rank">${i + 1}</span>` +
        `<span class="lb-name">${escapeHtml(row.username)}${row.isSelf ? " (you)" : ""}</span>` +
        `<span class="lb-score">${row.high}</span>` +
        remove;
      list.appendChild(li);
    });
  }

  function initFriends() {
    $("#add-friend-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = $("#friend-input");
      const username = input.value.trim();
      if (!username) {
        return;
      }
      const { ok, data } = await api("/friends", "POST", { username });
      const msg = $("#friend-msg");
      if (ok) {
        input.value = "";
        msg.style.color = "var(--good)";
        msg.textContent = `Added ${data.friend}.`;
        loadLeaderboard();
      } else {
        msg.style.color = "var(--danger)";
        msg.textContent = (data && data.error) || "Could not add friend.";
      }
    });

    $("#leaderboard").addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-remove]");
      if (!btn) {
        return;
      }
      await api(`/friends/${encodeURIComponent(btn.dataset.remove)}`, "DELETE");
      loadLeaderboard();
    });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ===== Burger drawer =====
  function selectDrawerPanel(panel) {
    document.querySelectorAll(".drawer-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.panel === panel);
    });
    document.querySelectorAll(".drawer-panel").forEach((p) => {
      p.classList.toggle("hidden", p.dataset.panel !== panel);
    });
  }

  function openDrawer() {
    $("#drawer").classList.remove("hidden");
    $("#drawer-backdrop").classList.remove("hidden");
    loadLeaderboard();
    if (window.Store) {
      window.Store.refresh();
    }
  }

  function closeDrawer() {
    $("#drawer").classList.add("hidden");
    $("#drawer-backdrop").classList.add("hidden");
  }

  function initDrawer() {
    $("#burger").addEventListener("click", openDrawer);
    $("#drawer-backdrop").addEventListener("click", closeDrawer);
    document.querySelectorAll(".drawer-tab").forEach((t) => {
      t.addEventListener("click", () => selectDrawerPanel(t.dataset.panel));
    });
  }

  // ===== Dvorak toggle =====
  function initDvorak() {
    const toggle = $("#dvorak-toggle");
    const saved = localStorage.getItem("snake:dvorak") === "1";
    toggle.checked = saved;
    window.Snake.setKeymap(saved ? "dvorak" : "qwerty");
    toggle.addEventListener("change", () => {
      const on = toggle.checked;
      localStorage.setItem("snake:dvorak", on ? "1" : "0");
      window.Snake.setKeymap(on ? "dvorak" : "qwerty");
    });
  }

  // ===== Confirm modal + toast (used by store.js) =====
  function confirmDialog(text) {
    return new Promise((resolve) => {
      const backdrop = $("#modal-backdrop");
      const okBtn = $("#modal-ok");
      const cancelBtn = $("#modal-cancel");
      $("#modal-text").textContent = text;
      backdrop.classList.remove("hidden");

      const cleanup = (result) => {
        backdrop.classList.add("hidden");
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        backdrop.removeEventListener("click", onBackdrop);
        resolve(result);
      };
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onBackdrop = (e) => {
        if (e.target === backdrop) {
          cleanup(false);
        }
      };
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      backdrop.addEventListener("click", onBackdrop);
    });
  }

  function toast(msg) {
    let el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  window.confirmDialog = confirmDialog;
  window.toast = toast;

  // ===== Boot =====
  async function boot() {
    initAuth();
    initGame();
    initFriends();
    initDrawer();
    initDvorak();
    window.addEventListener("hashchange", route);

    const { ok, data } = await api("/auth/me");
    if (ok) {
      showApp(data.username);
    } else {
      showGate();
    }
  }

  boot();
})();
