// Memory Match using my own travel photos. 8 pairs, a fresh random set each game.
import { albums } from '../data/photos';

const PAIRS = 8;
const BEST_KEY = 'memory-best';
const MISMATCH_MS = 900;

type Card = { src: string; title: string };

function shuffle<T>(a: T[]): T[] {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// One random photo from each of PAIRS different albums, so no two pairs look alike.
function pickPhotos(): Card[] {
  const usable = albums.filter((a) => a.photos.length > 0);
  return shuffle(usable)
    .slice(0, PAIRS)
    .map((a) => {
      const p = a.photos[Math.floor(Math.random() * a.photos.length)];
      return { src: p.thumb, title: a.title };
    });
}

export function initMemory(
  board: HTMLElement,
  movesEl: HTMLElement,
  bestEl: HTMLElement,
  statusEl: HTMLElement,
  newBtn: HTMLElement,
) {
  let deck: Card[] = [];
  let buttons: HTMLButtonElement[] = [];
  let open: number[] = [];
  let matched = new Set<number>();
  let moves = 0;
  let locked = false;
  let timer: number | undefined;
  let best = readBest();
  bestEl.textContent = best ? String(best) : '–';

  function readBest(): number {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  }
  function saveBest(n: number) {
    try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* storage unavailable */ }
  }

  function label(i: number): string {
    const c = deck[i];
    if (matched.has(i)) return `Card ${i + 1}: ${c.title}, matched`;
    if (open.includes(i)) return `Card ${i + 1}: ${c.title}`;
    return `Card ${i + 1}, face down`;
  }

  function paint(i: number) {
    const b = buttons[i];
    b.classList.toggle('mm-open', open.includes(i) || matched.has(i));
    b.classList.toggle('mm-matched', matched.has(i));
    b.setAttribute('aria-label', label(i));
    b.disabled = matched.has(i);
  }

  function deal() {
    window.clearTimeout(timer);
    const picks = pickPhotos();
    deck = shuffle([...picks, ...picks]);
    open = [];
    matched = new Set();
    moves = 0;
    locked = false;
    movesEl.textContent = '0';
    statusEl.textContent = 'Find all the matching pairs.';

    board.textContent = '';
    buttons = deck.map((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mm-card';
      b.innerHTML =
        '<span class="mm-inner"><span class="mm-face mm-back" aria-hidden="true">?</span>' +
        '<img class="mm-face mm-front" alt="" draggable="false" /></span>';
      (b.querySelector('.mm-front') as HTMLImageElement).src = c.src;
      b.addEventListener('click', () => flip(i));
      board.appendChild(b);
      return b;
    });
    deck.forEach((_, i) => paint(i));
  }

  function flip(i: number) {
    if (locked || matched.has(i) || open.includes(i)) return;
    open.push(i);
    paint(i);
    if (open.length < 2) return;

    moves++;
    movesEl.textContent = String(moves);
    const [a, b] = open;
    if (deck[a].src === deck[b].src) {
      matched.add(a);
      matched.add(b);
      open = [];
      paint(a);
      paint(b);
      if (matched.size === deck.length) win();
      else statusEl.textContent = `Match! ${deck.length / 2 - matched.size / 2} to go.`;
    } else {
      locked = true;
      statusEl.textContent = 'Not a match.';
      timer = window.setTimeout(() => {
        open = [];
        paint(a);
        paint(b);
        locked = false;
      }, MISMATCH_MS);
    }
  }

  function win() {
    const isBest = !best || moves < best;
    if (isBest) { best = moves; bestEl.textContent = String(best); saveBest(best); }
    statusEl.textContent = `You found them all in ${moves} moves${isBest ? ', a new best!' : '.'} Press New game to play again.`;
  }

  newBtn.addEventListener('click', deal);
  deal();
}
