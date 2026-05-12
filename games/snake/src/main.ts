import {
  createGameState,
  getCellKey,
  getKeyboardDirection,
  getSpeedLevel,
  getStepDurationMs,
  pauseGame,
  queueDirection,
  startGame,
  stepGame,
  type Direction,
  type Position,
  type SnakeState,
} from './game';
import './styles.css';

const GAME_SLUG = 'snake';
const BEST_SCORE_KEY = 'minigame:snake:best-score';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;

let state = createGameState(Math.random, readBestScore());
let frameId: number | null = null;
let lastStepTime = 0;
let touchStart: Position | null = null;

appRoot.innerHTML = `
  <main class="shell" data-shell>
    <header class="topbar">
      <div class="brand">
        <p>SNAKE</p>
        <h1>Snake</h1>
      </div>
      <div class="actions">
        <button type="button" data-action="toggle">Start</button>
        <button type="button" data-action="restart">New</button>
      </div>
    </header>

    <section class="hud" aria-label="Game status">
      <div>
        <span>SCORE</span>
        <strong data-score>0000</strong>
      </div>
      <div>
        <span>BEST</span>
        <strong data-best>0000</strong>
      </div>
      <div>
        <span>SPEED</span>
        <strong data-speed>01</strong>
      </div>
    </section>

    <section class="stage" aria-label="Snake play area">
      <section class="board" data-board aria-label="Snake board"></section>
      <div class="overlay" data-overlay aria-live="polite">
        <strong data-status-title>READY</strong>
        <span data-status-help>ARROW / WASD</span>
      </div>
    </section>
  </main>
`;

const shell = queryElement<HTMLElement>('[data-shell]');
const board = queryElement<HTMLElement>('[data-board]');
const overlay = queryElement<HTMLElement>('[data-overlay]');
const scoreElement = queryElement<HTMLElement>('[data-score]');
const bestElement = queryElement<HTMLElement>('[data-best]');
const speedElement = queryElement<HTMLElement>('[data-speed]');
const toggleButton = queryElement<HTMLButtonElement>('[data-action="toggle"]');
const restartButton = queryElement<HTMLButtonElement>('[data-action="restart"]');
const statusTitle = queryElement<HTMLElement>('[data-status-title]');
const statusHelp = queryElement<HTMLElement>('[data-status-help]');
const cellElements = new Map<string, HTMLElement>();

createBoard();
render();

toggleButton.addEventListener('click', togglePlay);
restartButton.addEventListener('click', restartGame);
window.addEventListener('keydown', handleKeyDown);
board.addEventListener('pointerdown', handlePointerDown);
board.addEventListener('pointerup', handlePointerUp);
window.addEventListener('message', handleHubMessage);
window.parent.postMessage({ type: 'minigame:ready', gameSlug: GAME_SLUG }, '*');

function createBoard(): void {
  board.style.setProperty('--grid-size', String(state.gridSize));
  board.innerHTML = '';
  cellElements.clear();

  for (let row = 0; row < state.gridSize; row += 1) {
    for (let column = 0; column < state.gridSize; column += 1) {
      const cell = document.createElement('span');
      const key = getCellKey({ row, column });
      cell.className = 'cell';
      cell.dataset.key = key;
      board.append(cell);
      cellElements.set(key, cell);
    }
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  const direction = getKeyboardDirection(event.code) ?? getKeyboardDirection(event.key);

  if (direction) {
    event.preventDefault();
    move(direction);
    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    togglePlay();
    return;
  }

  if (event.code === 'Enter') {
    event.preventDefault();
    restartGame();
  }
}

function handlePointerDown(event: PointerEvent): void {
  touchStart = {
    row: event.clientY,
    column: event.clientX,
  };
}

function handlePointerUp(event: PointerEvent): void {
  if (!touchStart) {
    return;
  }

  const deltaX = event.clientX - touchStart.column;
  const deltaY = event.clientY - touchStart.row;
  touchStart = null;

  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) {
    togglePlay();
    return;
  }

  const direction: Direction =
    Math.abs(deltaX) > Math.abs(deltaY)
      ? deltaX > 0
        ? 'right'
        : 'left'
      : deltaY > 0
        ? 'down'
        : 'up';

  move(direction);
}

function handleHubMessage(event: MessageEvent): void {
  const action = getHubAction(event.data);

  if (!action) {
    return;
  }

  if (action === 'start') {
    play();
    return;
  }

  if (action === 'pause') {
    pause();
    return;
  }

  if (action === 'reset') {
    restartGame();
  }
}

function move(direction: Direction): void {
  state = queueDirection(state, direction);

  if (state.phase === 'ready') {
    play();
    return;
  }

  render();
}

function togglePlay(): void {
  if (state.phase === 'playing') {
    pause();
    return;
  }

  if (state.phase === 'game-over' || state.phase === 'won') {
    restartGame();
    play();
    return;
  }

  play();
}

function play(): void {
  state = startGame(state);

  if (state.phase !== 'playing') {
    render();
    return;
  }

  lastStepTime = performance.now();
  render();
  requestLoop();
  window.parent.postMessage({ type: 'minigame:start', gameSlug: GAME_SLUG }, '*');
}

function pause(): void {
  state = pauseGame(state);
  cancelLoop();
  render();
  window.parent.postMessage({ type: 'minigame:pause', gameSlug: GAME_SLUG }, '*');
}

function restartGame(): void {
  cancelLoop();
  state = createGameState(Math.random, readBestScore());
  lastStepTime = 0;
  render();
}

function requestLoop(): void {
  if (frameId !== null) {
    return;
  }

  frameId = window.requestAnimationFrame(tick);
}

function cancelLoop(): void {
  if (frameId === null) {
    return;
  }

  window.cancelAnimationFrame(frameId);
  frameId = null;
}

function tick(time: number): void {
  frameId = null;

  if (state.phase !== 'playing') {
    return;
  }

  if (time - lastStepTime >= getStepDurationMs(state.score)) {
    lastStepTime = time;
    state = stepGame(state);
    persistBestScore(state.bestScore);
    render();

    if (state.phase === 'game-over' || state.phase === 'won') {
      window.parent.postMessage(
        {
          type: 'minigame:game-over',
          gameSlug: GAME_SLUG,
          score: state.score,
        },
        '*',
      );
      return;
    }
  }

  requestLoop();
}

function render(): void {
  const snakeKeys = new Set(state.snake.map(getCellKey));
  const headKey = getCellKey(state.snake[0] ?? state.food);
  const foodKey = getCellKey(state.food);

  for (const [key, cell] of cellElements) {
    const isHead = key === headKey;
    const isSnake = snakeKeys.has(key);
    const isFood = key === foodKey;

    cell.className = [
      'cell',
      isSnake ? 'cell--snake' : '',
      isHead ? 'cell--head' : '',
      isFood ? 'cell--food' : '',
    ]
      .filter(Boolean)
      .join(' ');
    cell.setAttribute('aria-label', getCellLabel(isHead, isSnake, isFood));
  }

  shell.dataset.phase = state.phase;
  scoreElement.textContent = formatScore(state.score);
  bestElement.textContent = formatScore(state.bestScore);
  speedElement.textContent = String(getSpeedLevel(state.score)).padStart(2, '0');
  toggleButton.textContent = getToggleLabel(state);
  overlay.hidden = state.phase === 'playing';
  statusTitle.textContent = getStatusTitle(state);
  statusHelp.textContent = getStatusHelp(state);
}

function getCellLabel(isHead: boolean, isSnake: boolean, isFood: boolean): string {
  if (isHead) {
    return 'snake head';
  }

  if (isSnake) {
    return 'snake body';
  }

  if (isFood) {
    return 'food';
  }

  return 'empty';
}

function getToggleLabel(current: SnakeState): string {
  if (current.phase === 'playing') {
    return 'Pause';
  }

  if (current.phase === 'game-over' || current.phase === 'won') {
    return 'Retry';
  }

  return 'Start';
}

function getStatusTitle(current: SnakeState): string {
  if (current.phase === 'paused') {
    return 'PAUSED';
  }

  if (current.phase === 'game-over') {
    return 'GAME OVER';
  }

  if (current.phase === 'won') {
    return 'CLEAR';
  }

  return 'READY';
}

function getStatusHelp(current: SnakeState): string {
  if (current.phase === 'paused') {
    return 'SPACE TO RESUME';
  }

  if (current.phase === 'game-over' || current.phase === 'won') {
    return 'ENTER TO RESET';
  }

  return 'ARROW / WASD';
}

function formatScore(score: number): string {
  return String(score).padStart(4, '0');
}

function readBestScore(): number {
  const value = window.localStorage.getItem(BEST_SCORE_KEY);
  const score = Number(value);

  return Number.isFinite(score) && score > 0 ? score : 0;
}

function persistBestScore(bestScore: number): void {
  window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
}

function queryElement<T extends HTMLElement>(selector: string): T {
  const element = appRoot.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Element was not found: ${selector}`);
  }

  return element;
}

function getHubAction(value: unknown): 'start' | 'pause' | 'reset' | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const message = value as {
    action?: unknown;
    command?: unknown;
    gameSlug?: unknown;
    slug?: unknown;
    type?: unknown;
  };
  const targetSlug = message.gameSlug ?? message.slug;

  if (targetSlug && targetSlug !== GAME_SLUG) {
    return null;
  }

  const action = message.action ?? message.command;

  if (
    message.type === 'minigame:control' &&
    (action === 'start' || action === 'pause' || action === 'reset')
  ) {
    return action;
  }

  return null;
}
