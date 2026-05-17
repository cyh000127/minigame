import './styles.css';
import {
  CELL_COUNT,
  GRID_SIZE,
  createGameState,
  forceGameOver,
  getDirectionFromInput,
  isLaserOnPosition,
  movePlayer,
  pauseGame,
  startGame,
  tickGame,
  type Direction,
  type GamePhase,
  type LaserGridState,
} from './game';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

interface MiniGameLifecycle {
  start(): void;
  pause(): void;
  gameOver(): void;
}

type HubCommand = 'start' | 'pause' | 'gameOver';

const BEST_SCORE_KEY = 'minigame:laser-grid:best-score';

let state: LaserGridState = createGameState(loadBestScore());
let frameId: number | null = null;
let lastFrameTime: number | null = null;

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p>LASER GRID</p>
        <h1>Laser Grid</h1>
      </div>
      <div class="actions">
        <button class="action action--primary" type="button" data-action="primary">Start</button>
        <button class="action" type="button" data-action="reset">New</button>
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
        <span>ENERGY</span>
        <strong data-energy>3</strong>
      </div>
      <div>
        <span>LEVEL</span>
        <strong data-level>1</strong>
      </div>
      <div>
        <span>LASER</span>
        <strong data-laser-count>0</strong>
      </div>
      <div>
        <span>TIME</span>
        <strong data-time>00</strong>
      </div>
    </section>

    <section class="grid" aria-label="Laser Grid board">
      ${Array.from({ length: CELL_COUNT }, (_, index) => `<button class="cell" type="button" data-cell-index="${index}" aria-label="Cell ${index + 1}"></button>`).join('')}
    </section>

    <section class="status-panel" aria-live="polite">
      <strong data-status>READY</strong>
      <span data-substatus>PRESS START</span>
    </section>
  </main>
`;

const shell = requireElement<HTMLElement>('.shell');
const primaryButton = requireElement<HTMLButtonElement>('[data-action="primary"]');
const resetButton = requireElement<HTMLButtonElement>('[data-action="reset"]');
const scoreText = requireElement<HTMLElement>('[data-score]');
const bestText = requireElement<HTMLElement>('[data-best]');
const energyText = requireElement<HTMLElement>('[data-energy]');
const levelText = requireElement<HTMLElement>('[data-level]');
const laserCountText = requireElement<HTMLElement>('[data-laser-count]');
const timeText = requireElement<HTMLElement>('[data-time]');
const statusText = requireElement<HTMLElement>('[data-status]');
const substatusText = requireElement<HTMLElement>('[data-substatus]');
const cellButtons = Array.from(app.querySelectorAll<HTMLButtonElement>('[data-cell-index]'));

const runtime: MiniGameLifecycle = {
  start() {
    if (state.phase === 'game-over') {
      resetGame(true);
      return;
    }

    state = startGame(state);
    render();
    ensureLoop();
  },
  pause() {
    state = pauseGame(state);
    stopLoop();
    render();
  },
  gameOver() {
    state = forceGameOver(state);
    saveBestScore(state.bestScore);
    stopLoop();
    render();
  },
};

primaryButton.addEventListener('click', () => {
  if (state.phase === 'playing') {
    runtime.pause();
    return;
  }

  runtime.start();
});

resetButton.addEventListener('click', () => {
  resetGame(true);
});

cellButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const direction = getDirectionToCell(Number(button.dataset.cellIndex));

    if (direction) {
      handleMove(direction);
    }
  });
});

window.addEventListener('keydown', (event) => {
  if (event.repeat) {
    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();

    if (state.phase === 'playing') {
      runtime.pause();
    } else {
      runtime.start();
    }

    return;
  }

  if (event.code === 'Enter') {
    event.preventDefault();
    resetGame(true);
    return;
  }

  const direction = getDirectionFromInput(event.code) ?? getDirectionFromInput(event.key);

  if (direction) {
    event.preventDefault();
    handleMove(direction);
  }
});

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  const command = getHubCommand(event.data);

  if (!command) {
    return;
  }

  if (command === 'start') {
    runtime.start();
  }

  if (command === 'pause') {
    runtime.pause();
  }

  if (command === 'gameOver') {
    runtime.gameOver();
  }
});

render();

function requireElement<TElement extends Element>(selector: string): TElement {
  const element = app?.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Required element was not found: ${selector}`);
  }

  return element;
}

function handleMove(direction: Direction): void {
  if (state.phase === 'ready') {
    state = startGame(state);
  }

  state = movePlayer(state, direction);
  saveBestScore(state.bestScore);
  render();
  ensureLoop();

  if (state.phase === 'game-over') {
    stopLoop();
  }
}

function ensureLoop(): void {
  if (frameId !== null || state.phase !== 'playing') {
    return;
  }

  frameId = window.requestAnimationFrame(loop);
}

function stopLoop(): void {
  if (frameId !== null) {
    window.cancelAnimationFrame(frameId);
    frameId = null;
  }

  lastFrameTime = null;
}

function loop(timestamp: number): void {
  frameId = null;

  if (state.phase !== 'playing') {
    lastFrameTime = null;
    return;
  }

  if (lastFrameTime === null) {
    lastFrameTime = timestamp;
  }

  const deltaMs = timestamp - lastFrameTime;
  lastFrameTime = timestamp;
  state = tickGame(state, deltaMs);
  saveBestScore(state.bestScore);
  render();

  if (state.phase === 'playing') {
    frameId = window.requestAnimationFrame(loop);
  } else {
    lastFrameTime = null;
  }
}

function resetGame(shouldStart: boolean): void {
  stopLoop();
  state = createGameState(Math.max(state.bestScore, loadBestScore()));

  if (shouldStart) {
    state = startGame(state);
  }

  render();
  ensureLoop();
}

function render(): void {
  shell.dataset.phase = state.phase;
  scoreText.textContent = formatScore(state.score);
  bestText.textContent = formatScore(state.bestScore);
  energyText.textContent = state.energy.toString();
  levelText.textContent = state.level.toString();
  laserCountText.textContent = state.lasers.length.toString();
  timeText.textContent = Math.floor(state.elapsedMs / 1000).toString().padStart(2, '0');
  statusText.textContent = getStatusText(state.phase);
  substatusText.textContent = getSubstatusText(state);
  primaryButton.textContent = getPrimaryButtonText(state.phase);

  cellButtons.forEach((button, index) => {
    const position = indexToPosition(index);
    const isPlayer = state.player.row === position.row && state.player.column === position.column;
    const hasWarning = state.lasers.some(
      (laser) => laser.phase === 'warning' && isLaserOnPosition(laser, position),
    );
    const hasActive = state.lasers.some(
      (laser) => laser.phase === 'active' && isLaserOnPosition(laser, position),
    );

    button.innerHTML = getCellMarkup(isPlayer, hasActive, hasWarning);
    button.disabled = state.phase !== 'playing';
    button.classList.toggle('is-player', isPlayer);
    button.classList.toggle('is-warning', hasWarning);
    button.classList.toggle('is-active', hasActive);
    button.classList.toggle('is-danger', isPlayer && hasActive);
  });
}

function getCellMarkup(isPlayer: boolean, hasActive: boolean, hasWarning: boolean): string {
  if (isPlayer && hasActive) {
    return `
      <span class="cell__stack">
        <span class="cell__label">CORE</span>
        <span class="cell__badge cell__badge--danger">FIRE</span>
      </span>
    `;
  }

  if (isPlayer && hasWarning) {
    return `
      <span class="cell__stack">
        <span class="cell__label">CORE</span>
        <span class="cell__badge cell__badge--warning">WARN</span>
      </span>
    `;
  }

  if (isPlayer) {
    return '<span class="cell__label">CORE</span>';
  }

  if (hasActive) {
    return '<span class="cell__label">FIRE</span>';
  }

  if (hasWarning) {
    return '<span class="cell__label">WARN</span>';
  }

  return '';
}

function getDirectionToCell(index: number): Direction | null {
  const target = indexToPosition(index);
  const rowDelta = target.row - state.player.row;
  const columnDelta = target.column - state.player.column;

  if (rowDelta === -1 && columnDelta === 0) {
    return 'up';
  }

  if (rowDelta === 1 && columnDelta === 0) {
    return 'down';
  }

  if (rowDelta === 0 && columnDelta === -1) {
    return 'left';
  }

  if (rowDelta === 0 && columnDelta === 1) {
    return 'right';
  }

  return null;
}

function indexToPosition(index: number): { row: number; column: number } {
  return {
    row: Math.floor(index / GRID_SIZE),
    column: index % GRID_SIZE,
  };
}

function formatScore(score: number): string {
  return Math.trunc(score).toString().padStart(4, '0');
}

function getPrimaryButtonText(phase: GamePhase): string {
  if (phase === 'playing') {
    return 'Pause';
  }

  if (phase === 'paused') {
    return 'Resume';
  }

  if (phase === 'game-over') {
    return 'Again';
  }

  return 'Start';
}

function getStatusText(phase: GamePhase): string {
  const statusByPhase: Record<GamePhase, string> = {
    ready: 'READY',
    playing: 'RUN',
    paused: 'PAUSED',
    'game-over': 'DOWN',
  };

  return statusByPhase[phase];
}

function getSubstatusText(nextState: LaserGridState): string {
  if (nextState.phase === 'game-over') {
    return 'ENERGY EMPTY';
  }

  if (nextState.phase === 'paused') {
    return 'HOLD POSITION';
  }

  if (nextState.lasers.some((laser) => laser.phase === 'active')) {
    return 'MOVE NOW';
  }

  if (nextState.lasers.some((laser) => laser.phase === 'warning')) {
    return 'WATCH LINES';
  }

  return 'SURVIVE';
}

function loadBestScore(): number {
  const saved = window.localStorage.getItem(BEST_SCORE_KEY);
  const parsedScore = saved ? Number.parseInt(saved, 10) : 0;

  return Number.isFinite(parsedScore) ? parsedScore : 0;
}

function saveBestScore(bestScore: number): void {
  window.localStorage.setItem(BEST_SCORE_KEY, Math.trunc(bestScore).toString());
}

function getHubCommand(data: unknown): HubCommand | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const message = data as Record<string, unknown>;

  if (message.source === 'minigame-hub') {
    return normalizeCommand(message.command);
  }

  if (message.type === 'minigame:control') {
    return normalizeCommand(message.command ?? message.action);
  }

  return null;
}

function normalizeCommand(command: unknown): HubCommand | null {
  if (command === 'start' || command === 'pause' || command === 'gameOver') {
    return command;
  }

  if (command === 'game-over') {
    return 'gameOver';
  }

  return null;
}
