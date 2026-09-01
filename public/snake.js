// Self-contained snake game. app.js mounts it and handles score persistence.
(function () {
  const GRID = 20; // cells per side
  const TICK_START = 140; // ms per step
  const TICK_MIN = 70;
  const SLOW_TICK_START = 230; // slow-mo potion pacing
  const SLOW_TICK_MIN = 130;

  let ctx = null;
  let cell = 20;
  let snake, dir, nextDir, food, score, running, timer, tick;
  let handlers = {};

  // Applied from the store: equipped skins + consumable effects.
  let cfg = { snakeColor: null, foodColor: null, boardColor: null, rainbow: false, slowMo: false };
  let livesRemaining = 0;

  function tickStart() {
    return cfg.slowMo ? SLOW_TICK_START : TICK_START;
  }
  function tickMin() {
    return cfg.slowMo ? SLOW_TICK_MIN : TICK_MIN;
  }

  function rand(n) {
    return Math.floor(Math.random() * n);
  }

  function placeFood() {
    while (true) {
      const f = { x: rand(GRID), y: rand(GRID) };
      if (!snake.some((s) => s.x === f.x && s.y === f.y)) {
        return f;
      }
    }
  }

  function reset() {
    snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    food = placeFood();
    score = 0;
    tick = tickStart();
    handlers.onScore && handlers.onScore(0);
  }

  // Extra Life: keep score, food and difficulty; just reset the snake's body.
  function respawn() {
    snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    dir = { x: 1, y: 0 };
    nextDir = dir;
  }

  function step() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
    const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) {
      return loseLifeOrEnd();
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 1;
      handlers.onScore && handlers.onScore(score);
      food = placeFood();
      tick = Math.max(tickMin(), tickStart() - score * 3);
    } else {
      snake.pop();
    }

    draw();
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    if (running) {
      timer = setTimeout(step, tick);
    }
  }

  function draw() {
    const css = getComputedStyle(document.documentElement);
    ctx.fillStyle = cfg.boardColor || css.getPropertyValue("--bg-elev").trim() || "#25272b";
    ctx.fillRect(0, 0, GRID * cell, GRID * cell);

    ctx.fillStyle = cfg.foodColor || css.getPropertyValue("--food").trim() || "#ed4245";
    roundRect(food.x * cell, food.y * cell, cell, cell);

    const snakeColor = cfg.snakeColor || css.getPropertyValue("--snake").trim() || "#3ba55d";
    snake.forEach((s, i) => {
      if (cfg.rainbow) {
        ctx.fillStyle = `hsl(${(i * 18) % 360}, 75%, ${i === 0 ? 65 : 55}%)`;
      } else {
        ctx.fillStyle = snakeColor;
      }
      roundRect(s.x * cell, s.y * cell, cell, cell);
      // Lighten the head so it reads as the front regardless of skin color.
      if (i === 0 && !cfg.rainbow) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
        roundRect(s.x * cell, s.y * cell, cell, cell);
      }
    });
  }

  function roundRect(x, y, w, h) {
    const pad = 1;
    const r = 4;
    const x0 = x + pad;
    const y0 = y + pad;
    const w0 = w - pad * 2;
    const h0 = h - pad * 2;
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.arcTo(x0 + w0, y0, x0 + w0, y0 + h0, r);
    ctx.arcTo(x0 + w0, y0 + h0, x0, y0 + h0, r);
    ctx.arcTo(x0, y0 + h0, x0, y0, r);
    ctx.arcTo(x0, y0, x0 + w0, y0, r);
    ctx.fill();
  }

  function start() {
    if (running) {
      return;
    }
    reset();
    running = true;
    // Only capture keyboard input while actually playing — outside of a run the
    // page must not steal keystrokes (e.g. typing in the login / add-friend fields).
    window.addEventListener("keydown", onKey);
    draw();
    schedule();
    handlers.onStart && handlers.onStart();
  }

  // On a crash, spend an Extra Life if one is available, otherwise end the run.
  function loseLifeOrEnd() {
    if (livesRemaining > 0) {
      livesRemaining -= 1;
      handlers.onLifeLost && handlers.onLifeLost(livesRemaining);
      respawn();
      draw();
      schedule();
      return;
    }
    gameOver();
  }

  function gameOver() {
    running = false;
    window.removeEventListener("keydown", onKey);
    clearTimeout(timer);
    handlers.onGameOver && handlers.onGameOver(score);
  }

  function setDir(x, y) {
    // Ignore reversals into the snake's own neck.
    if (dir.x === -x && dir.y === -y) {
      return;
    }
    nextDir = { x, y };
  }

  const ARROWS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  const KEYMAPS = {
    // WASD on QWERTY.
    qwerty: {
      ...ARROWS,
      w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
      W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
    },
    // The same physical keys emit ,/a/o/e on a Dvorak layout.
    dvorak: {
      ...ARROWS,
      ",": [0, -1], o: [0, 1], a: [-1, 0], e: [1, 0],
      "<": [0, -1], O: [0, 1], A: [-1, 0], E: [1, 0],
    },
  };
  let KEYS = KEYMAPS.qwerty;

  function setKeymap(mode) {
    KEYS = KEYMAPS[mode] || KEYMAPS.qwerty;
  }

  function isTyping(target) {
    if (!target) {
      return false;
    }
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
  }

  function onKey(e) {
    // Belt-and-suspenders: even mid-game, never steer while a field is focused.
    if (!running || isTyping(e.target)) {
      return;
    }
    const move = KEYS[e.key];
    if (move) {
      e.preventDefault();
      setDir(move[0], move[1]);
    }
  }

  function mount(canvas, opts) {
    ctx = canvas.getContext("2d");
    cell = canvas.width / GRID;
    handlers = opts || {};
    reset();
    draw();

    // Touch: tap to start, swipe to steer.
    let touchStart = null;
    canvas.addEventListener("touchstart", (e) => {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (!running) {
        start();
      }
    }, { passive: true });
    canvas.addEventListener("touchmove", (e) => {
      if (!touchStart || !running) {
        return;
      }
      const dx = e.touches[0].clientX - touchStart.x;
      const dy = e.touches[0].clientY - touchStart.y;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) {
        setDir(dx > 0 ? 1 : -1, 0);
      } else {
        setDir(0, dy > 0 ? 1 : -1);
      }
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
  }

  // Called before start() with the player's equipped skins + consumables.
  function configure(opts) {
    const o = opts || {};
    cfg = {
      snakeColor: o.snakeColor || null,
      foodColor: o.foodColor || null,
      boardColor: o.boardColor || null,
      rainbow: !!o.rainbow,
      slowMo: !!o.slowMo,
    };
    livesRemaining = o.extraLives || 0;
    // Reflect equipped skins on the idle board (behind the "Ready?" overlay).
    if (ctx && !running) {
      draw();
    }
  }

  window.Snake = { mount, start, configure, setKeymap, isRunning: () => running };
})();
