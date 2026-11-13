// Classic Snake on a canvas. Arrow keys / WASD, Space to pause, swipe on touch.

type Point = { x: number; y: number };
type Dir = Point;

const GRID = 20; // cells per side
const TICK_MS = 110;
const BEST_KEY = 'snake-best';

export function initSnake(canvas: HTMLCanvasElement, scoreEl: HTMLElement, bestEl: HTMLElement, statusEl: HTMLElement) {
  const ctx = canvas.getContext('2d')!;
  const cell = canvas.width / GRID;

  let snake: Point[] = [];
  let dir: Dir = { x: 1, y: 0 };
  let queued: Dir | null = null;
  let food: Point = { x: 5, y: 5 };
  let score = 0;
  let best = readBest();
  let state: 'ready' | 'running' | 'paused' | 'over' = 'ready';
  let timer: number | undefined;

  bestEl.textContent = String(best);

  function readBest(): number {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  }
  function saveBest(n: number) {
    try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* storage unavailable */ }
  }

  function css(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function reset() {
    const mid = Math.floor(GRID / 2);
    snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
    dir = { x: 1, y: 0 };
    queued = null;
    score = 0;
    scoreEl.textContent = '0';
    placeFood();
    draw();
  }

  function placeFood() {
    while (true) {
      const p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
      if (!snake.some((s) => s.x === p.x && s.y === p.y)) { food = p; return; }
    }
  }

  function setStatus(msg: string) { statusEl.textContent = msg; }

  function start() {
    if (state === 'over' || state === 'ready') reset();
    state = 'running';
    setStatus('');
    window.clearInterval(timer);
    timer = window.setInterval(step, TICK_MS);
  }

  function pause() {
    if (state !== 'running') return;
    state = 'paused';
    window.clearInterval(timer);
    setStatus('Paused. Press Space to resume.');
  }

  function gameOver() {
    state = 'over';
    window.clearInterval(timer);
    if (score > best) { best = score; bestEl.textContent = String(best); saveBest(best); }
    setStatus(`Game over. Score ${score}. Press Space to play again.`);
    draw();
  }

  function step() {
    if (queued) { dir = queued; queued = null; }
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
    // The tail moves away this tick unless we eat, so ignore it when checking self-collision.
    const willEat = head.x === food.x && head.y === food.y;
    const body = willEat ? snake : snake.slice(0, -1);
    const hitSelf = body.some((s) => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) { gameOver(); return; }

    snake.unshift(head);
    if (willEat) {
      score += 1;
      scoreEl.textContent = String(score);
      if (snake.length >= GRID * GRID) { gameOver(); return; } // board full: nowhere to put food
      placeFood();
    } else {
      snake.pop();
    }
    draw();
  }

  function draw() {
    ctx.fillStyle = css('--surface') || '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ef4444';
    ctx.fillRect(food.x * cell + 2, food.y * cell + 2, cell - 4, cell - 4);

    ctx.fillStyle = css('--accent') || '#2563eb';
    snake.forEach((s, i) => {
      ctx.globalAlpha = i === 0 ? 1 : 0.8;
      ctx.fillRect(s.x * cell + 1, s.y * cell + 1, cell - 2, cell - 2);
    });
    ctx.globalAlpha = 1;
  }

  function turn(next: Dir) {
    // Start first: start() resets the board, which would otherwise wipe the queued turn.
    if (state === 'ready' || state === 'over') start();
    const base = queued ?? dir;
    if (next.x === -base.x && next.y === -base.y) return; // no reversing
    if (next.x === base.x && next.y === base.y) return;
    queued = next;
  }

  const keyMap: Record<string, Dir> = {
    ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 },
  };

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts alone (Cmd+S, Ctrl+D...)
    if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault(); // stop page scrolling
    if (e.key === ' ') {
      if (e.repeat) return; // holding Space shouldn't flicker pause/resume
      if (state === 'running') pause(); else start();
      return;
    }
    const d = keyMap[e.key];
    if (d && state !== 'paused') turn(d);
  });

  // Touch: swipe to steer, tap to start/pause.
  let touchStart: Point | null = null;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) {
      if (state === 'running') pause(); else start();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) turn({ x: dx > 0 ? 1 : -1, y: 0 });
    else turn({ x: 0, y: dy > 0 ? 1 : -1 });
  });

  // Auto-pause when the tab is hidden.
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  reset();
  setStatus('Press Space or an arrow key to start.');
}
