// 2048. Arrow keys / WASD or swipe. Slide tiles, merge equal ones, reach 2048.

const SIZE = 4;
const BEST_KEY = 'game2048-best';

type Grid = number[][];
type Move = 'left' | 'right' | 'up' | 'down';

// ---- pure game logic (kept free of the DOM so it is easy to reason about) ----

function slideRowLeft(row: number[]): { row: number[]; gained: number } {
  const vals = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] === vals[i + 1]) {
      out.push(vals[i] * 2);
      gained += vals[i] * 2;
      i++; // a tile merges at most once per move
    } else {
      out.push(vals[i]);
    }
  }
  while (out.length < SIZE) out.push(0);
  return { row: out, gained };
}

const reverseRows = (g: Grid): Grid => g.map((r) => r.slice().reverse());
const transpose = (g: Grid): Grid => g[0].map((_, c) => g.map((r) => r[c]));

function applyMove(grid: Grid, dir: Move): { grid: Grid; gained: number; moved: boolean } {
  // Rotate the board so every direction becomes "slide left", then rotate back.
  let g = grid;
  if (dir === 'right') g = reverseRows(g);
  if (dir === 'up') g = transpose(g);
  if (dir === 'down') g = reverseRows(transpose(g));

  let gained = 0;
  g = g.map((row) => {
    const res = slideRowLeft(row);
    gained += res.gained;
    return res.row;
  });

  if (dir === 'right') g = reverseRows(g);
  if (dir === 'up') g = transpose(g);
  if (dir === 'down') g = transpose(reverseRows(g));

  const moved = g.some((row, r) => row.some((v, c) => v !== grid[r][c]));
  return { grid: g, gained, moved };
}

function emptyCells(g: Grid): [number, number][] {
  const out: [number, number][] = [];
  g.forEach((row, r) => row.forEach((v, c) => { if (v === 0) out.push([r, c]); }));
  return out;
}

function canMove(g: Grid): boolean {
  if (emptyCells(g).length > 0) return true;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (c + 1 < SIZE && g[r][c] === g[r][c + 1]) return true;
      if (r + 1 < SIZE && g[r][c] === g[r + 1][c]) return true;
    }
  }
  return false;
}

// ---- UI ----

export function init2048(
  cells: HTMLElement[],
  touchArea: HTMLElement,
  scoreEl: HTMLElement,
  bestEl: HTMLElement,
  statusEl: HTMLElement,
  newBtn: HTMLElement,
) {
  let grid: Grid = [];
  let score = 0;
  let best = readBest();
  let won = false;
  let over = false;

  bestEl.textContent = String(best);

  function readBest(): number {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  }
  function saveBest(n: number) {
    try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* storage unavailable */ }
  }

  function spawn(): [number, number] | null {
    const free = emptyCells(grid);
    if (free.length === 0) return null;
    const [r, c] = free[Math.floor(Math.random() * free.length)];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    return [r, c];
  }

  function render(fresh: [number, number] | null) {
    grid.forEach((row, r) =>
      row.forEach((v, c) => {
        const el = cells[r * SIZE + c];
        el.textContent = v ? String(v) : '';
        el.dataset.v = String(v);
        // Blue to purple as values grow; white text stays readable throughout.
        el.style.background = v ? `hsl(${Math.min(210 + Math.log2(v) * 10, 330)} 62% 42%)` : '';
        el.style.fontSize = v >= 1024 ? '1.3rem' : v >= 128 ? '1.6rem' : '';
        el.classList.toggle('pop', !!fresh && fresh[0] === r && fresh[1] === c);
        el.setAttribute('aria-label', v ? String(v) : 'empty');
      }),
    );
    scoreEl.textContent = String(score);
  }

  function newGame() {
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    score = 0;
    won = false;
    over = false;
    spawn();
    const fresh = spawn();
    render(fresh);
    statusEl.textContent = 'Use the arrow keys or swipe to slide the tiles.';
  }

  function move(dir: Move) {
    if (over) return;
    const res = applyMove(grid, dir);
    if (!res.moved) return;
    grid = res.grid;
    score += res.gained;
    if (score > best) { best = score; bestEl.textContent = String(best); saveBest(best); }
    const fresh = spawn();
    render(fresh);

    if (!won && grid.some((row) => row.includes(2048))) {
      won = true;
      statusEl.textContent = 'You made 2048! Keep going if you like.';
    }
    if (!canMove(grid)) {
      over = true;
      statusEl.textContent = `No moves left. Final score ${score}. Press New game to try again.`;
    }
  }

  const keyMap: Record<string, Move> = {
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowDown: 'down', s: 'down', S: 'down',
  };

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts alone
    const dir = keyMap[e.key];
    if (!dir) return;
    if (e.key.startsWith('Arrow')) e.preventDefault(); // stop page scrolling
    move(dir);
  });

  let start: { x: number; y: number } | null = null;
  touchArea.addEventListener('touchstart', (e) => {
    start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    e.preventDefault();
  }, { passive: false });
  touchArea.addEventListener('touchend', (e) => {
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
    else move(dy > 0 ? 'down' : 'up');
  });

  newBtn.addEventListener('click', newGame);
  newGame();
}
