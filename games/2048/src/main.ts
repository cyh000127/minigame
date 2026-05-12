import './styles.css';
import {
  applyMove,
  BOARD_SIZE,
  CELL_COUNT,
  continueAfterWin,
  createGameState,
  getCell,
  type Direction,
  type GameState,
} from './game';

interface MiniGameLifecycleMessage {
  readonly source: 'minigame-hub';
  readonly command: 'start' | 'pause' | 'gameOver';
  readonly gameSlug: string;
}

const BEST_SCORE_KEY = 'minigame:2048:best-score';
const SWIPE_THRESHOLD_PX = 32;
const TARGET_TILES = [1024, 2048, 4096] as const;

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;

appRoot.innerHTML = `
  <main class="game-shell" data-paused="false">
    <header class="hero">
      <div class="hero__copy">
        <h1>2048</h1>
        <p>Join the numbers and get to the <strong>2048 tile!</strong></p>
      </div>
      <aside class="score-panel" aria-label="Score board">
        <div>
          <span>SCORE</span>
          <strong data-score>0</strong>
        </div>
        <div>
          <span>BEST</span>
          <strong data-best>0</strong>
        </div>
      </aside>
    </header>

    <section class="action-row">
      <p>Use arrow keys or swipe to move every tile on the board.</p>
      <div class="action-row__controls">
        <label class="target-select">
          <span>Goal</span>
          <select data-target>
            ${TARGET_TILES.map((tile) => `<option value="${tile}"${tile === 2048 ? ' selected' : ''}>${tile}</option>`).join('')}
          </select>
        </label>
        <button data-undo type="button" disabled>Undo</button>
        <button data-new-game type="button">New Game</button>
      </div>
    </section>

    <section class="board-wrap">
      <div class="board" data-board aria-label="2048 board" role="grid"></div>
      <div class="overlay" data-overlay hidden>
        <p data-overlay-kicker>GAME OVER</p>
        <h2 data-overlay-title>Try again</h2>
        <div class="overlay__actions">
          <button data-continue type="button">Keep going</button>
          <button data-restart type="button">New Game</button>
        </div>
      </div>
    </section>
  </main>
`;

const shell = mustQuery<HTMLElement>('.game-shell');
const scoreElement = mustQuery<HTMLElement>('[data-score]');
const bestElement = mustQuery<HTMLElement>('[data-best]');
const boardElement = mustQuery<HTMLElement>('[data-board]');
const targetSelect = mustQuery<HTMLSelectElement>('[data-target]');
const undoButton = mustQuery<HTMLButtonElement>('[data-undo]');
const newGameButton = mustQuery<HTMLButtonElement>('[data-new-game]');
const overlayElement = mustQuery<HTMLElement>('[data-overlay]');
const overlayKicker = mustQuery<HTMLElement>('[data-overlay-kicker]');
const overlayTitle = mustQuery<HTMLElement>('[data-overlay-title]');
const continueButton = mustQuery<HTMLButtonElement>('[data-continue]');
const restartButton = mustQuery<HTMLButtonElement>('[data-restart]');

let targetTile = Number.parseInt(targetSelect.value, 10);
let state = createGameState(Math.random, loadBestScore(), targetTile);
let undoState: GameState | null = null;
let paused = false;
let touchStart: { readonly x: number; readonly y: number } | null = null;

newGameButton.addEventListener('click', restartGame);
undoButton.addEventListener('click', undoMove);
targetSelect.addEventListener('change', () => {
  targetTile = Number.parseInt(targetSelect.value, 10);
  restartGame();
});
restartButton.addEventListener('click', restartGame);
continueButton.addEventListener('click', () => {
  state = continueAfterWin(state);
  paused = false;
  render();
});

window.addEventListener('keydown', (event) => {
  const direction = getDirectionFromKey(event.key);

  if (!direction) {
    if (event.key.toLowerCase() === 'u') {
      event.preventDefault();
      undoMove();
    }

    return;
  }

  event.preventDefault();
  move(direction);
});

boardElement.addEventListener(
  'touchstart',
  (event) => {
    const touch = event.changedTouches[0];

    if (!touch) {
      return;
    }

    touchStart = {
      x: touch.clientX,
      y: touch.clientY,
    };
  },
  { passive: true },
);

boardElement.addEventListener(
  'touchend',
  (event) => {
    const touch = event.changedTouches[0];

    if (!touchStart || !touch) {
      return;
    }

    const direction = getSwipeDirection(touch.clientX - touchStart.x, touch.clientY - touchStart.y);
    touchStart = null;

    if (!direction) {
      return;
    }

    event.preventDefault();
    move(direction);
  },
  { passive: false },
);

window.addEventListener('message', (event: MessageEvent<MiniGameLifecycleMessage>) => {
  if (event.data?.source !== 'minigame-hub' || event.data.gameSlug !== '2048') {
    return;
  }

  if (event.data.command === 'start') {
    paused = false;
    render();
  }

  if (event.data.command === 'pause') {
    paused = true;
    render();
  }

  if (event.data.command === 'gameOver') {
    state = {
      ...state,
      status: 'game-over',
    };
    paused = false;
    render();
  }
});

render();

function restartGame(): void {
  state = createGameState(Math.random, state.bestScore, targetTile);
  undoState = null;
  paused = false;
  render();
}

function move(direction: Direction): void {
  if (paused || state.status !== 'playing') {
    return;
  }

  const previousState = state;
  const nextState = applyMove(state, direction);

  if (nextState === state) {
    return;
  }

  undoState = previousState;
  state = nextState;
  saveBestScore(state.bestScore);
  render();
}

function undoMove(): void {
  if (paused || !undoState || state.status !== 'playing') {
    return;
  }

  state = {
    ...undoState,
    bestScore: state.bestScore,
  };
  undoState = null;
  render();
}

function render(): void {
  shell.dataset.paused = paused ? 'true' : 'false';
  scoreElement.textContent = state.score.toString();
  bestElement.textContent = state.bestScore.toString();
  undoButton.disabled = paused || !undoState || state.status !== 'playing';
  boardElement.innerHTML = Array.from({ length: CELL_COUNT }, (_, index) => renderCell(index)).join('');
  renderOverlay();
}

function renderCell(index: number): string {
  const value = getCell(state.board, index);
  const row = Math.floor(index / BOARD_SIZE) + 1;
  const column = (index % BOARD_SIZE) + 1;

  if (value === 0) {
    return `<div class="cell" role="gridcell" aria-label="${row}행 ${column}열 빈 칸"></div>`;
  }

  return `
    <div class="cell" role="gridcell" aria-label="${row}행 ${column}열 ${value}">
      <span data-value="${getTileValueKey(value)}" data-digits="${value.toString().length}">${value}</span>
    </div>
  `;
}

function renderOverlay(): void {
  const showPaused = paused;
  const showWon = state.status === 'won';
  const showGameOver = state.status === 'game-over';
  const visible = showPaused || showWon || showGameOver;

  overlayElement.hidden = !visible;
  continueButton.hidden = !showWon;

  if (showPaused) {
    overlayKicker.textContent = 'PAUSED';
    overlayTitle.textContent = '잠시 멈춤';
    continueButton.hidden = false;
    continueButton.textContent = 'Resume';
    return;
  }

  continueButton.textContent = 'Keep going';

  if (showWon) {
    overlayKicker.textContent = 'YOU WIN';
    overlayTitle.textContent = '2048 달성';
    return;
  }

  if (showGameOver) {
    overlayKicker.textContent = 'GAME OVER';
    overlayTitle.textContent = '더 이상 움직일 수 없습니다';
  }
}

function getDirectionFromKey(key: string): Direction | null {
  const keyMap: Record<string, Direction> = {
    ArrowUp: 'up',
    ArrowRight: 'right',
    ArrowDown: 'down',
    ArrowLeft: 'left',
  };

  return keyMap[key] ?? null;
}

function getSwipeDirection(deltaX: number, deltaY: number): Direction | null {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD_PX) {
    return null;
  }

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX > 0 ? 'right' : 'left';
  }

  return deltaY > 0 ? 'down' : 'up';
}

function getTileValueKey(value: number): string {
  return value >= 2048 ? '2048' : value.toString();
}

function loadBestScore(): number {
  const storedValue = window.localStorage.getItem(BEST_SCORE_KEY);
  const parsedValue = Number.parseInt(storedValue ?? '0', 10);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function saveBestScore(score: number): void {
  window.localStorage.setItem(BEST_SCORE_KEY, score.toString());
}

function mustQuery<TElement extends Element>(selector: string): TElement {
  const element = appRoot.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Missing UI element: ${selector}`);
  }

  return element;
}
