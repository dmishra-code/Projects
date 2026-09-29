/* ==========================================================================
   Neon Snake — vanilla JavaScript, no dependencies
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- Configuration ---------- */

  const GRID_SIZE = 20;                       // tiles per side
  const BOARD_PX = 400;                       // logical canvas size in px
  const TILE = BOARD_PX / GRID_SIZE;          // 20px tiles
  const START_LENGTH = 3;
  const BASE_INTERVAL_MS = 150;               // time per move at level 1
  const MIN_INTERVAL_MS = 60;                 // fastest possible speed
  const SPEED_STEP_MS = 3;                    // faster by this much per food
  const FOODS_PER_LEVEL = 5;
  const POINTS_PER_FOOD = 10;
  const INPUT_QUEUE_LIMIT = 3;                // buffered turns between ticks
  const SWIPE_THRESHOLD_PX = 24;
  const GAME_OVER_DELAY_MS = 450;             // pause before the modal appears
  const STORAGE_KEY = 'neon-snake.highScore';
  const TAU = Math.PI * 2;

  const COLORS = {
    grid: 'rgba(120, 150, 190, 0.07)',
    food: '#ffb020',
    foodGlow: 'rgba(255, 176, 32, 0.9)',
    snakeGlow: 'rgba(57, 255, 136, 0.9)',
    snakeTube: 'rgba(57, 255, 136, 0.35)',
    dead: '#ff5a72',
    eye: '#06120b'
  };

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  const KEY_MAP = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    w: 'up',
    s: 'down',
    a: 'left',
    d: 'right'
  };

  const OVERLAYS = {
    ready: {
      title: 'Snake',
      message: 'Eat the glowing food to grow. Avoid the walls and your own tail.',
      button: 'Start game',
      hint: 'Press Space or an arrow key to begin.'
    },
    paused: {
      title: 'Paused',
      message: 'The game is paused.',
      button: 'Resume',
      hint: 'Press Space or P to resume.'
    },
    over: {
      title: 'Game over',
      message: '',
      button: 'Play again',
      hint: 'Press Enter or Space to play again.'
    },
    win: {
      title: 'You win!',
      message: 'The board is full. You cannot grow any longer.',
      button: 'Play again',
      hint: 'Press Enter or Space to play again.'
    }
  };

  const GAME_OVER_REASONS = {
    wall: 'You hit the wall.',
    self: 'You ran into your own tail.'
  };

  /* ---------- DOM ---------- */

  const $ = (id) => document.getElementById(id);

  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const screenEl = $('screen');
  const scoreEl = $('score');
  const highEl = $('high-score');
  const levelEl = $('level');
  const overlay = $('overlay');
  const overlayTitle = $('overlay-title');
  const overlayMessage = $('overlay-message');
  const overlayResult = $('overlay-result');
  const overlayButton = $('overlay-button');
  const overlayHint = $('overlay-hint');
  const resultScore = $('result-score');
  const resultBest = $('result-best');
  const resultBadge = $('result-badge');
  const pauseButton = $('pause-btn');
  const statusEl = $('status');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- State ---------- */

  const state = {
    phase: 'ready',        // 'ready' | 'running' | 'paused' | 'over'
    snake: [],             // snake[0] is the head
    dir: DIRS.right,       // direction of the last completed move
    queue: [],             // buffered turns, applied one per tick
    food: null,
    score: 0,
    high: 0,
    foodsEaten: 0,
    newRecord: false,
    won: false,
    overAt: 0,
    session: 0,
    acc: 0,
    lastTime: 0
  };

  let scale = 1; // device pixels per logical pixel

  /* ---------- Persistence ---------- */

  function loadHighScore() {
    try {
      const value = parseInt(window.localStorage.getItem(STORAGE_KEY), 10);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function saveHighScore(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch (err) {
      /* Storage unavailable (private mode, blocked). The game still works. */
    }
  }

  /* ---------- Helpers ---------- */

  const pad = (n) => String(n).padStart(4, '0');

  function currentLevel() {
    return Math.floor(state.foodsEaten / FOODS_PER_LEVEL) + 1;
  }

  function currentInterval() {
    return Math.max(MIN_INTERVAL_MS, BASE_INTERVAL_MS - state.foodsEaten * SPEED_STEP_MS);
  }

  function announce(message) {
    statusEl.textContent = message;
  }

  function updateHud(bump) {
    scoreEl.textContent = pad(state.score);
    highEl.textContent = pad(state.high);
    levelEl.textContent = String(currentLevel());

    if (bump) {
      scoreEl.classList.remove('bump');
      void scoreEl.offsetWidth; // restart the CSS animation
      scoreEl.classList.add('bump');
    }
  }

  function setPhase(phase) {
    state.phase = phase;
    document.body.dataset.phase = phase;
    pauseButton.setAttribute('aria-label', phase === 'running' ? 'Pause' : phase === 'paused' ? 'Resume' : phase === 'ready' ? 'Start' : 'Play again');
  }

  /* ---------- Game setup ---------- */

  function spawnFood() {
    const occupied = new Set(state.snake.map((s) => s.y * GRID_SIZE + s.x));
    const free = [];

    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      if (!occupied.has(i)) free.push(i);
    }

    if (free.length === 0) {
      state.food = null;
      return false;
    }

    const pick = free[Math.floor(Math.random() * free.length)];
    state.food = { x: pick % GRID_SIZE, y: Math.floor(pick / GRID_SIZE) };
    return true;
  }

  function resetGame() {
    const midY = Math.floor(GRID_SIZE / 2);
    const headX = Math.floor(GRID_SIZE / 4) + START_LENGTH;

    state.snake = [];
    for (let i = 0; i < START_LENGTH; i++) {
      state.snake.push({ x: headX - i, y: midY });
    }

    state.dir = DIRS.right;
    state.queue = [];
    state.score = 0;
    state.foodsEaten = 0;
    state.newRecord = false;
    state.won = false;
    state.acc = 0;
    state.lastTime = 0;

    spawnFood();
    updateHud(false);
  }

  /* ---------- Input ---------- */

  function queueDirection(name) {
    const next = DIRS[name];
    const reference = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;

    if (next === reference) return;                                 // already heading that way
    if (next.x === -reference.x && next.y === -reference.y) return; // would reverse into the neck
    if (state.queue.length >= INPUT_QUEUE_LIMIT) return;

    state.queue.push(next);
  }

  function handleDirection(name) {
    if (state.phase === 'ready') {
      startGame();
    }
    if (state.phase === 'running') {
      queueDirection(name);
    }
  }

  /* ---------- Game flow ---------- */

  function startGame() {
    state.session += 1;
    resetGame();
    screenEl.classList.remove('shake');
    setPhase('running');
    hideOverlay();
    announce('Game started');
  }

  function pauseGame() {
    if (state.phase !== 'running') return;
    setPhase('paused');
    showOverlay('paused');
    announce('Game paused');
  }

  function resumeGame() {
    if (state.phase !== 'paused') return;
    state.acc = 0;
    state.lastTime = 0;
    setPhase('running');
    hideOverlay();
    announce('Game resumed');
  }

  function endGame(reason) {
    const session = state.session;

    state.won = reason === 'win';
    state.overAt = performance.now();
    setPhase('over');

    if (!state.won && !reduceMotion.matches) {
      screenEl.classList.remove('shake');
      void screenEl.offsetWidth;
      screenEl.classList.add('shake');
    }

    const kind = state.won ? 'win' : 'over';
    const message = state.won ? OVERLAYS.win.message : GAME_OVER_REASONS[reason];

    announce(
      (state.won ? 'You win. ' : 'Game over. ') +
      'Score ' + state.score + (state.newRecord ? '. New high score.' : '.')
    );

    window.setTimeout(() => {
      if (state.phase === 'over' && state.session === session) {
        showOverlay(kind, message);
      }
    }, GAME_OVER_DELAY_MS);
  }

  function primaryAction() {
    switch (state.phase) {
      case 'ready':
        startGame();
        break;
      case 'running':
        pauseGame();
        break;
      case 'paused':
        resumeGame();
        break;
      case 'over':
        // Ignore key mashing until the game-over modal has appeared.
        if (performance.now() - state.overAt >= GAME_OVER_DELAY_MS) startGame();
        break;
      default:
        break;
    }
  }

  function step() {
    if (state.queue.length) {
      state.dir = state.queue.shift();
    }

    const head = state.snake[0];
    const nx = head.x + state.dir.x;
    const ny = head.y + state.dir.y;

    if (nx < 0 || ny < 0 || nx >= GRID_SIZE || ny >= GRID_SIZE) {
      endGame('wall');
      return;
    }

    const eating = state.food !== null && nx === state.food.x && ny === state.food.y;

    // The tail moves out of the way on a normal step, so it is safe to enter.
    const solidSegments = eating ? state.snake.length : state.snake.length - 1;
    for (let i = 0; i < solidSegments; i++) {
      if (state.snake[i].x === nx && state.snake[i].y === ny) {
        endGame('self');
        return;
      }
    }

    state.snake.unshift({ x: nx, y: ny });

    if (!eating) {
      state.snake.pop();
      return;
    }

    state.score += POINTS_PER_FOOD;
    state.foodsEaten += 1;

    if (state.score > state.high) {
      state.high = state.score;
      state.newRecord = true;
      saveHighScore(state.high);
    }

    updateHud(true);

    if (!spawnFood()) {
      endGame('win');
    }
  }

  /* ---------- Overlay ---------- */

  function showOverlay(kind, customMessage) {
    const config = OVERLAYS[kind];
    const showResult = kind === 'over' || kind === 'win';

    overlay.dataset.state = kind;
    overlayTitle.textContent = config.title;
    overlayMessage.textContent = customMessage || config.message;
    overlayButton.textContent = config.button;
    overlayHint.textContent = config.hint;
    overlayResult.hidden = !showResult;

    if (showResult) {
      resultScore.textContent = pad(state.score);
      resultBest.textContent = pad(state.high);
      resultBadge.hidden = !state.newRecord;
    }

    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');

    if (kind !== 'paused') {
      overlayButton.focus({ preventScroll: true });
    }
  }

  function hideOverlay() {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');

    if (overlay.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  }

  /* ---------- Rendering ---------- */

  function roundedRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawGrid() {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < GRID_SIZE; i++) {
      const p = i * TILE;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, BOARD_PX);
      ctx.moveTo(0, p);
      ctx.lineTo(BOARD_PX, p);
    }
    ctx.stroke();
  }

  function drawFood(time) {
    if (!state.food) return;

    const cx = (state.food.x + 0.5) * TILE;
    const cy = (state.food.y + 0.5) * TILE;
    const pulse = reduceMotion.matches ? 0 : Math.sin(time / 240);
    const radius = TILE * 0.3 + pulse * 1.2;

    ctx.save();
    ctx.shadowColor = COLORS.foodGlow;
    ctx.shadowBlur = (14 + pulse * 4) * scale;
    ctx.fillStyle = COLORS.food;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.24, 0, TAU);
    ctx.fill();
  }

  function drawEyes(head, isDead) {
    const cx = (head.x + 0.5) * TILE;
    const cy = (head.y + 0.5) * TILE;
    const dx = state.dir.x;
    const dy = state.dir.y;
    const forward = TILE * 0.16;
    const side = TILE * 0.2;

    ctx.fillStyle = COLORS.eye;
    [-1, 1].forEach((sign) => {
      const ex = cx + dx * forward + -dy * side * sign;
      const ey = cy + dy * forward + dx * side * sign;
      ctx.beginPath();
      ctx.arc(ex, ey, isDead ? 1.4 : 2.2, 0, TAU);
      ctx.fill();
    });
  }

  function drawSnake() {
    const snake = state.snake;
    const length = snake.length;
    const isDead = state.phase === 'over' && !state.won;

    // Soft glow: one shadowed stroke along the whole body (cheap for long snakes).
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = TILE - 8;
    ctx.strokeStyle = COLORS.snakeTube;
    ctx.shadowColor = COLORS.snakeGlow;
    ctx.shadowBlur = 16 * scale;
    ctx.beginPath();
    snake.forEach((seg, i) => {
      const x = (seg.x + 0.5) * TILE;
      const y = (seg.y + 0.5) * TILE;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // Segments, tail first so the head is drawn on top.
    for (let i = length - 1; i >= 0; i--) {
      const seg = snake[i];
      const t = length > 1 ? i / (length - 1) : 0;
      const lightness = 60 - t * 26;

      ctx.fillStyle = i === 0 && isDead ? COLORS.dead : 'hsl(146, 100%, ' + lightness + '%)';
      roundedRect(ctx, seg.x * TILE + 1.5, seg.y * TILE + 1.5, TILE - 3, TILE - 3, i === 0 ? 6 : 4);
      ctx.fill();
    }

    drawEyes(snake[0], isDead);
  }

  function draw(time) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);
    drawGrid();
    drawFood(time);
    drawSnake();
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssSize = canvas.clientWidth || BOARD_PX;
    const pixels = Math.max(1, Math.round(cssSize * dpr));

    if (canvas.width !== pixels || canvas.height !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }
    scale = canvas.width / BOARD_PX;
  }

  /* ---------- Main loop ---------- */

  function frame(time) {
    window.requestAnimationFrame(frame);

    if (state.phase === 'running') {
      if (state.lastTime === 0) state.lastTime = time;

      state.acc += time - state.lastTime;
      state.lastTime = time;

      const interval = currentInterval();
      if (state.acc > interval * 2) state.acc = interval * 2; // avoid catch-up bursts after a stall

      while (state.acc >= interval && state.phase === 'running') {
        state.acc -= interval;
        step();
      }
    } else {
      state.lastTime = 0;
    }

    draw(time);
  }

  /* ---------- Event wiring ---------- */

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const onButton = event.target instanceof HTMLButtonElement;

    const direction = KEY_MAP[key];
    if (direction) {
      event.preventDefault();
      handleDirection(direction);
      return;
    }

    // A focused button activates natively on Space/Enter; don't double-trigger.
    if ((key === ' ' || key === 'Enter') && onButton) return;

    if (key === ' ') {
      event.preventDefault();
      if (!event.repeat) primaryAction();
    } else if (key === 'p' || key === 'Escape') {
      if (event.repeat) return;
      if (state.phase === 'running') pauseGame();
      else if (state.phase === 'paused') resumeGame();
    } else if (key === 'Enter') {
      if (event.repeat) return;
      if (state.phase !== 'running') primaryAction();
    }
  });

  overlayButton.addEventListener('click', () => {
    primaryAction();
    overlayButton.blur();
  });

  pauseButton.addEventListener('click', () => {
    primaryAction();
    pauseButton.blur();
  });

  document.querySelectorAll('[data-dir]').forEach((button) => {
    // pointerdown gives the lowest-latency response on touch screens.
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      handleDirection(button.dataset.dir);
    });
    // Keyboard activation (Enter/Space) produces a click with detail === 0.
    button.addEventListener('click', (event) => {
      if (event.detail === 0) handleDirection(button.dataset.dir);
    });
  });

  let touchOrigin = null;

  screenEl.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchOrigin = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  screenEl.addEventListener('touchmove', (event) => {
    if (!touchOrigin || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const dx = touch.clientX - touchOrigin.x;
    const dy = touch.clientY - touchOrigin.y;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD_PX) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      handleDirection(dx > 0 ? 'right' : 'left');
    } else {
      handleDirection(dy > 0 ? 'down' : 'up');
    }
    touchOrigin = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  ['touchend', 'touchcancel'].forEach((name) => {
    screenEl.addEventListener(name, () => { touchOrigin = null; }, { passive: true });
  });

  screenEl.addEventListener('contextmenu', (event) => event.preventDefault());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
  });

  window.addEventListener('resize', resizeCanvas);
  if ('ResizeObserver' in window) {
    new ResizeObserver(resizeCanvas).observe(canvas);
  }

  /* ---------- Boot ---------- */

  state.high = loadHighScore();
  resetGame();
  setPhase('ready');
  resizeCanvas();
  showOverlay('ready');
  window.requestAnimationFrame(frame);
})();
