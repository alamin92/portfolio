// Sky Fighter: a vertical shooter. The plane fires automatically.
// Move: arrow keys / WASD, or drag a finger. Start / pause: Space, P or tap.

const W = 400;
const H = 600;
const BEST_KEY = 'skyfighter-best';
const START_LIVES = 3;
const FIRE_EVERY = 0.22; // seconds between shots
const INVULN = 1.6; // seconds of protection after being hit

type Bullet = { x: number; y: number };
type Enemy = { x: number; y: number; vx: number; vy: number; r: number; hp: number; maxHp: number; big: boolean };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type Star = { x: number; y: number; s: number; v: number };

export function initSkyFighter(
  canvas: HTMLCanvasElement,
  scoreEl: HTMLElement,
  bestEl: HTMLElement,
  livesEl: HTMLElement,
  statusEl: HTMLElement,
) {
  const ctx = canvas.getContext('2d')!;

  let state: 'ready' | 'running' | 'paused' | 'over' = 'ready';
  let player = { x: W / 2, y: H - 70 };
  let bullets: Bullet[] = [];
  let enemies: Enemy[] = [];
  let sparks: Spark[] = [];
  const stars: Star[] = Array.from({ length: 50 }, () => ({
    x: Math.random() * W, y: Math.random() * H, s: 1 + Math.random() * 1.5, v: 20 + Math.random() * 50,
  }));
  let score = 0;
  let lives = START_LIVES;
  let best = readBest();
  let elapsed = 0;
  let fireTimer = 0;
  let spawnTimer = 0;
  let bigTimer = 0;
  let invuln = 0;
  let last = 0;
  let raf = 0;
  const keys = new Set<string>();
  let touch: { x: number; y: number; ox: number; oy: number } | null = null; // target plane position + finger offset
  let colors = { bg: '#fff', fg: '#111', accent: '#2563eb' };

  bestEl.textContent = String(best);

  function readBest(): number {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  }
  function saveBest(n: number) {
    try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* storage unavailable */ }
  }
  function css(name: string, fallback: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }
  function readColors() {
    colors = { bg: css('--surface', '#fff'), fg: css('--text', '#111'), accent: css('--accent', '#2563eb') };
  }
  function setStatus(msg: string) { statusEl.textContent = msg; }
  function updateHud() {
    scoreEl.textContent = String(score);
    livesEl.textContent = '♥'.repeat(Math.max(lives, 0)) || '–';
  }

  function reset() {
    player = { x: W / 2, y: H - 70 };
    bullets = []; enemies = []; sparks = [];
    score = 0; lives = START_LIVES; elapsed = 0;
    fireTimer = 0; spawnTimer = 0.6; bigTimer = 12; invuln = 0;
    updateHud();
  }

  function start() {
    if (state === 'ready' || state === 'over') reset();
    state = 'running';
    setStatus('');
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    if (state !== 'running') return;
    state = 'paused';
    cancelAnimationFrame(raf);
    setStatus('Paused. Press Space or P to resume.');
    draw();
  }
  function gameOver() {
    state = 'over';
    cancelAnimationFrame(raf);
    if (score > best) { best = score; bestEl.textContent = String(best); saveBest(best); }
    setStatus(`Game over. Score ${score}. Press Space or tap to fly again.`);
    draw();
  }

  function burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 140;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.4, color });
    }
  }

  function spawnEnemy(big: boolean) {
    const r = big ? 26 : 14 + Math.random() * 4;
    const speedUp = Math.min(elapsed / 40, 2.5); // enemies speed up over the first ~100 seconds
    enemies.push({
      x: r + Math.random() * (W - 2 * r),
      y: -r,
      vx: (Math.random() - 0.5) * (big ? 30 : 70),
      vy: (big ? 45 : 70 + Math.random() * 40) * (1 + speedUp * 0.5),
      r, hp: big ? 8 : 1, maxHp: big ? 8 : 1, big,
    });
  }

  function update(dt: number) {
    elapsed += dt;
    invuln = Math.max(0, invuln - dt);

    // Movement: keyboard, or follow a dragged finger.
    const speed = 260;
    let dx = 0, dy = 0;
    if (keys.has('ArrowLeft') || keys.has('a')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('d')) dx += 1;
    if (keys.has('ArrowUp') || keys.has('w')) dy -= 1;
    if (keys.has('ArrowDown') || keys.has('s')) dy += 1;
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    player.x += dx * speed * dt;
    player.y += dy * speed * dt;
    if (touch) { player.x = touch.x; player.y = touch.y; }
    player.x = Math.min(W - 18, Math.max(18, player.x));
    player.y = Math.min(H - 24, Math.max(60, player.y));

    // Auto-fire.
    fireTimer -= dt;
    if (fireTimer <= 0) {
      fireTimer = FIRE_EVERY;
      bullets.push({ x: player.x - 9, y: player.y - 14 }, { x: player.x + 9, y: player.y - 14 });
    }
    bullets.forEach((b) => { b.y -= 560 * dt; });
    bullets = bullets.filter((b) => b.y > -10);

    // Spawning gets faster the longer you survive.
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnEnemy(false);
      spawnTimer = Math.max(0.2, 0.9 - elapsed * 0.012) * (0.7 + Math.random() * 0.6);
    }
    bigTimer -= dt;
    if (bigTimer <= 0) { spawnEnemy(true); bigTimer = Math.max(7, 14 - elapsed * 0.05); }

    enemies.forEach((e) => {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < e.r || e.x > W - e.r) e.vx *= -1;
    });

    // Bullets vs enemies.
    for (const e of enemies) {
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + 3) {
          bullets.splice(i, 1);
          e.hp -= 1;
          burst(b.x, b.y, '#fbbf24', 2);
          if (e.hp <= 0) break;
        }
      }
      if (e.hp <= 0) {
        score += e.big ? 50 : 10;
        burst(e.x, e.y, e.big ? '#f97316' : '#ef4444', e.big ? 30 : 12);
      }
    }
    enemies = enemies.filter((e) => e.hp > 0 && e.y < H + e.r + 10);
    scoreEl.textContent = String(score);

    // Enemies vs player.
    if (invuln <= 0) {
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (Math.hypot(e.x - player.x, e.y - player.y) < e.r + 12) {
          enemies.splice(i, 1);
          burst(player.x, player.y, colors.accent, 24);
          lives -= 1;
          invuln = INVULN;
          updateHud();
          if (lives <= 0) { gameOver(); return; }
          break;
        }
      }
    }

    sparks.forEach((s) => { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; });
    sparks = sparks.filter((s) => s.life > 0);
    stars.forEach((s) => { s.y += s.v * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
  }

  function drawPlane(x: number, y: number) {
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x + 6, y - 4);
    ctx.lineTo(x + 22, y + 10);
    ctx.lineTo(x + 22, y + 15);
    ctx.lineTo(x + 6, y + 9);
    ctx.lineTo(x + 5, y + 20);
    ctx.lineTo(x + 11, y + 24);
    ctx.lineTo(x - 11, y + 24);
    ctx.lineTo(x - 5, y + 20);
    ctx.lineTo(x - 6, y + 9);
    ctx.lineTo(x - 22, y + 15);
    ctx.lineTo(x - 22, y + 10);
    ctx.lineTo(x - 6, y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = colors.bg; // cockpit
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 3.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = colors.fg;
    stars.forEach((s) => { ctx.globalAlpha = 0.18 + s.s * 0.1; ctx.fillRect(s.x, s.y, s.s, s.s * 2); });
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#fbbf24';
    bullets.forEach((b) => ctx.fillRect(b.x - 1.5, b.y - 7, 3, 12));

    enemies.forEach((e) => {
      ctx.fillStyle = e.big ? '#f97316' : '#ef4444';
      ctx.beginPath();
      // A downward-pointing ship: round top, pointed nose.
      ctx.moveTo(e.x - e.r, e.y - e.r * 0.6);
      ctx.lineTo(e.x + e.r, e.y - e.r * 0.6);
      ctx.lineTo(e.x + e.r * 0.5, e.y + e.r * 0.4);
      ctx.lineTo(e.x, e.y + e.r);
      ctx.lineTo(e.x - e.r * 0.5, e.y + e.r * 0.4);
      ctx.closePath();
      ctx.fill();
      if (e.big) { // health bar
        ctx.fillStyle = colors.fg;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 4);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(e.x - e.r, e.y - e.r - 8, (e.r * 2 * e.hp) / e.maxHp, 4);
      }
    });

    sparks.forEach((s) => { ctx.globalAlpha = Math.max(s.life, 0) * 2; ctx.fillStyle = s.color; ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3); });
    ctx.globalAlpha = 1;

    if (state !== 'over' && !(invuln > 0 && Math.floor(invuln * 12) % 2 === 0)) drawPlane(player.x, player.y);

    if (state !== 'running') {
      ctx.fillStyle = colors.fg;
      ctx.globalAlpha = 0.08;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.fg;
      ctx.textAlign = 'center';
      ctx.font = '700 28px system-ui, sans-serif';
      const title = state === 'over' ? 'Game over' : state === 'paused' ? 'Paused' : 'Sky Fighter';
      ctx.fillText(title, W / 2, H / 2 - 10);
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(state === 'over' ? `Score ${score}` : 'Tap or press Space', W / 2, H / 2 + 20);
    }
  }

  function frame(now: number) {
    if (state !== 'running') return;
    const dt = Math.min((now - last) / 1000, 0.05); // cap so a long pause can't teleport things
    last = now;
    update(dt);
    if (state === 'running') { draw(); raf = requestAnimationFrame(frame); }
  }

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts alone
    if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault(); // stop page scrolling
    if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
      if (e.repeat) return;
      if (state === 'running') pause(); else start();
      return;
    }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys.add(k);
    // Pressing a move key from the title screen starts the game.
    if (state === 'ready' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(k)) start();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  window.addEventListener('blur', () => keys.clear());

  // Touch: drag anywhere on the canvas to fly. Tap to start / pause.
  function canvasPoint(t: Touch) {
    const r = canvas.getBoundingClientRect();
    return { x: ((t.clientX - r.left) / r.width) * W, y: ((t.clientY - r.top) / r.height) * H };
  }
  let tapStart = 0;
  let moved = false;
  let startPt = { x: 0, y: 0 };
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const p = canvasPoint(e.touches[0]);
    startPt = p; moved = false; tapStart = performance.now();
    // Keep the plane at a fixed offset from the finger so the finger doesn't hide it.
    touch = { x: player.x, y: player.y, ox: player.x - p.x, oy: player.y - p.y };
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!touch) return;
    const p = canvasPoint(e.touches[0]);
    if (Math.hypot(p.x - startPt.x, p.y - startPt.y) > 8) moved = true;
    touch.x = p.x + touch.ox;
    touch.y = p.y + touch.oy;
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    touch = null;
    if (!moved && performance.now() - tapStart < 300) { if (state === 'running') pause(); else start(); }
  }, { passive: false });
  canvas.addEventListener('click', () => { if (state !== 'running') start(); });

  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  readColors();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); draw(); });
  reset();
  draw();
  setStatus('Press Space, an arrow key or tap to take off.');
}
