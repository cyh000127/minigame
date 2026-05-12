import './styles.css';
import {
  createGameState,
  DIFFICULTIES,
  getRemainingMines,
  revealAdjacentCells,
  revealCell,
  tickTimer,
  toggleFlag,
  type DifficultyId,
  type MinesweeperState,
} from './game';

interface MiniGameLifecycleMessage {
  readonly source: 'minigame-hub';
  readonly command: 'start' | 'pause' | 'gameOver';
  readonly gameSlug: string;
}

const BEST_TIME_PREFIX = 'minigame:minesweeper:best-time:';
const LONG_PRESS_MS = 520;

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;

appRoot.innerHTML = `
  <main class="shell" data-phase="ready">
    <header class="topbar">
      <div>
        <p>MINESWEEPER</p>
        <h1>지뢰찾기</h1>
      </div>
      <button data-new-game type="button">New Game</button>
    </header>

    <section class="status-panel" aria-label="Game status">
      <div>
        <span>MINES</span>
        <strong data-mines>000</strong>
      </div>
      <div>
        <span>TIME</span>
        <strong data-time>000</strong>
      </div>
      <div>
        <span>BEST</span>
        <strong data-best>--</strong>
      </div>
    </section>

    <section class="difficulty-panel" aria-label="Difficulty selector">
      ${DIFFICULTIES.map(
        (difficulty) =>
          `<button data-difficulty="${difficulty.id}" type="button">${difficulty.label}</button>`,
      ).join('')}
    </section>

    <section class="board-wrap">
      <section class="board" data-board aria-label="Minesweeper board" role="grid"></section>
      <div class="overlay" data-overlay hidden>
        <p data-overlay-kicker>READY</p>
        <h2 data-overlay-title>첫 칸을 열어 시작</h2>
        <button data-overlay-action type="button">New Game</button>
      </div>
    </section>

    <footer class="help-text">좌클릭은 열기, 우클릭/길게 누르기는 깃발, 숫자 칸 더블클릭은 주변 동시 열기입니다.</footer>
  </main>
`;

const shell = mustQuery<HTMLElement>('.shell');
const minesElement = mustQuery<HTMLElement>('[data-mines]');
const timeElement = mustQuery<HTMLElement>('[data-time]');
const bestElement = mustQuery<HTMLElement>('[data-best]');
const boardElement = mustQuery<HTMLElement>('[data-board]');
const newGameButton = mustQuery<HTMLButtonElement>('[data-new-game]');
const overlayElement = mustQuery<HTMLElement>('[data-overlay]');
const overlayKicker = mustQuery<HTMLElement>('[data-overlay-kicker]');
const overlayTitle = mustQuery<HTMLElement>('[data-overlay-title]');
const overlayAction = mustQuery<HTMLButtonElement>('[data-overlay-action]');

let state = createGameState('easy');
let frameId = 0;
let lastTickMs = performance.now();
let longPressTimer = 0;
let longPressHandled = false;
let paused = false;

newGameButton.addEventListener('click', () => restartGame(state.difficulty.id));
overlayAction.addEventListener('click', () => {
  if (paused) {
    paused = false;
    lastTickMs = performance.now();
    startLoop();
    render();
    return;
  }

  restartGame(state.difficulty.id);
});

for (const button of appRoot.querySelectorAll<HTMLButtonElement>('[data-difficulty]')) {
  button.addEventListener('click', () => {
    const difficultyId = button.dataset.difficulty as DifficultyId;
    restartGame(difficultyId);
  });
}

boardElement.addEventListener('click', (event) => {
  const cellButton = getCellButton(event.target);

  if (!cellButton || longPressHandled) {
    longPressHandled = false;
    return;
  }

  reveal(Number(cellButton.dataset.index));
});

boardElement.addEventListener('dblclick', (event) => {
  const cellButton = getCellButton(event.target);

  if (!cellButton) {
    return;
  }

  event.preventDefault();
  chord(Number(cellButton.dataset.index));
});

boardElement.addEventListener('contextmenu', (event) => {
  const cellButton = getCellButton(event.target);

  if (!cellButton) {
    return;
  }

  event.preventDefault();
  flag(Number(cellButton.dataset.index));
});

boardElement.addEventListener(
  'pointerdown',
  (event) => {
    const cellButton = getCellButton(event.target);

    if (!cellButton || event.pointerType === 'mouse') {
      return;
    }

    longPressHandled = false;
    window.clearTimeout(longPressTimer);
    longPressTimer = window.setTimeout(() => {
      longPressHandled = true;
      flag(Number(cellButton.dataset.index));
    }, LONG_PRESS_MS);
  },
  { passive: true },
);

boardElement.addEventListener('pointerup', clearLongPress);
boardElement.addEventListener('pointercancel', clearLongPress);
boardElement.addEventListener('pointerleave', clearLongPress);

window.addEventListener('message', (event: MessageEvent<MiniGameLifecycleMessage>) => {
  if (event.data?.source !== 'minigame-hub' || event.data.gameSlug !== 'minesweeper') {
    return;
  }

  if (event.data.command === 'start') {
    paused = false;
    lastTickMs = performance.now();
    startLoop();
    render();
  }

  if (event.data.command === 'pause') {
    paused = true;
    stopLoop();
    render();
  }

  if (event.data.command === 'gameOver') {
    state = {
      ...state,
      phase: 'lost',
    };
    paused = false;
    stopLoop();
    render();
  }
});

render();

function restartGame(difficultyId: DifficultyId): void {
  state = createGameState(difficultyId);
  paused = false;
  lastTickMs = performance.now();
  stopLoop();
  render();
}

function reveal(index: number): void {
  if (paused) {
    return;
  }

  state = revealCell(state, index);
  handlePostMove();
}

function flag(index: number): void {
  if (paused) {
    return;
  }

  state = toggleFlag(state, index);
  handlePostMove();
}

function chord(index: number): void {
  if (paused) {
    return;
  }

  state = revealAdjacentCells(state, index);
  handlePostMove();
}

function handlePostMove(): void {
  if (state.phase === 'playing') {
    startLoop();
  } else {
    stopLoop();
  }

  if (state.phase === 'won') {
    saveBestTime(state);
  }

  render();
}

function startLoop(): void {
  if (frameId || state.phase !== 'playing') {
    return;
  }

  lastTickMs = performance.now();
  frameId = window.requestAnimationFrame(loop);
}

function loop(nowMs: number): void {
  const elapsedSeconds = Math.floor((nowMs - lastTickMs) / 1_000);

  if (elapsedSeconds > 0) {
    state = tickTimer(state, elapsedSeconds);
    lastTickMs += elapsedSeconds * 1_000;
    render();
  }

  if (state.phase === 'playing' && !paused) {
    frameId = window.requestAnimationFrame(loop);
    return;
  }

  stopLoop();
}

function stopLoop(): void {
  if (!frameId) {
    return;
  }

  window.cancelAnimationFrame(frameId);
  frameId = 0;
}

function render(): void {
  shell.dataset.phase = paused ? 'paused' : state.phase;
  minesElement.textContent = formatCounter(getRemainingMines(state));
  timeElement.textContent = formatCounter(state.elapsedSeconds);
  bestElement.textContent = formatBestTime(state.difficulty.id);
  boardElement.style.setProperty('--columns', state.difficulty.width.toString());
  boardElement.style.setProperty('--rows', state.difficulty.height.toString());
  boardElement.innerHTML = state.cells.map(renderCell).join('');
  renderDifficultyButtons();
  renderOverlay();
}

function renderCell(cell: MinesweeperState['cells'][number]): string {
  const classes = ['cell'];

  if (cell.isRevealed) {
    classes.push('cell--open');
  }

  if (cell.isFlagged) {
    classes.push('cell--flagged');
  }

  if (cell.hasMine && cell.isRevealed) {
    classes.push('cell--mine');
  }

  const label = `${cell.row + 1}행 ${cell.column + 1}열`;
  const content = getCellContent(cell);

  return `
    <button
      class="${classes.join(' ')}"
      data-index="${cell.index}"
      data-number="${cell.adjacentMines}"
      type="button"
      role="gridcell"
      aria-label="${label}"
      ${cell.isRevealed ? 'aria-pressed="true"' : ''}
    >${content}</button>
  `;
}

function getCellContent(cell: MinesweeperState['cells'][number]): string {
  if (cell.isFlagged && !cell.isRevealed) {
    return 'F';
  }

  if (!cell.isRevealed) {
    return '';
  }

  if (cell.hasMine) {
    return '*';
  }

  return cell.adjacentMines > 0 ? cell.adjacentMines.toString() : '';
}

function renderDifficultyButtons(): void {
  for (const button of appRoot.querySelectorAll<HTMLButtonElement>('[data-difficulty]')) {
    button.classList.toggle('is-selected', button.dataset.difficulty === state.difficulty.id);
  }
}

function renderOverlay(): void {
  const visible = paused || state.phase === 'won' || state.phase === 'lost';

  overlayElement.hidden = !visible;

  if (paused) {
    overlayKicker.textContent = 'PAUSED';
    overlayTitle.textContent = '잠시 멈춤';
    overlayAction.textContent = 'Resume';
    return;
  }

  overlayAction.textContent = 'New Game';

  if (state.phase === 'won') {
    overlayKicker.textContent = 'CLEAR';
    overlayTitle.textContent = `${state.elapsedSeconds}초 기록`;
  }

  if (state.phase === 'lost') {
    overlayKicker.textContent = 'BOOM';
    overlayTitle.textContent = '지뢰를 밟았습니다';
  }
}

function getCellButton(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest<HTMLButtonElement>('[data-index]');
}

function clearLongPress(): void {
  window.clearTimeout(longPressTimer);
}

function getBestTimeKey(difficultyId: DifficultyId): string {
  return `${BEST_TIME_PREFIX}${difficultyId}`;
}

function loadBestTime(difficultyId: DifficultyId): number | null {
  const value = window.localStorage.getItem(getBestTimeKey(difficultyId));
  const parsedValue = Number.parseInt(value ?? '', 10);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function saveBestTime(nextState: MinesweeperState): void {
  const currentBest = loadBestTime(nextState.difficulty.id);

  if (currentBest !== null && currentBest <= nextState.elapsedSeconds) {
    return;
  }

  window.localStorage.setItem(
    getBestTimeKey(nextState.difficulty.id),
    nextState.elapsedSeconds.toString(),
  );
}

function formatBestTime(difficultyId: DifficultyId): string {
  const bestTime = loadBestTime(difficultyId);

  return bestTime === null ? '--' : formatCounter(bestTime);
}

function formatCounter(value: number): string {
  return value.toString().padStart(3, '0').slice(-3);
}

function mustQuery<TElement extends Element>(selector: string): TElement {
  const element = appRoot.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Missing UI element: ${selector}`);
  }

  return element;
}
