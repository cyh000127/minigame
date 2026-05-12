import {
  createGameState,
  forceGameOver,
  getKeyboardHole,
  getMoleLifetimeMs,
  pauseGame,
  resumeGame,
  startGame,
  tickGame,
  whackHole,
  type Mole,
  type WhackMoleState,
} from './game';
import './styles.css';

const GAME_SLUG = 'whack-mole';
const BEST_SCORE_KEY = 'minigame:whack-mole:best-score';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;

let state = createGameState(readBestScore());
let frameId: number | null = null;
let lastFrameTime = 0;
let lastHitHole: number | null = null;

appRoot.innerHTML = `
  <main class="shell" data-shell>
    <header class="topbar">
      <div class="brand">
        <p>WHACK MOLE</p>
        <h1>Whack Mole</h1>
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
        <span>TIME</span>
        <strong data-time>30</strong>
      </div>
      <div>
        <span>LIFE</span>
        <strong data-life>03</strong>
      </div>
      <div>
        <span>LEVEL</span>
        <strong data-level>01</strong>
      </div>
      <div>
        <span>COMBO</span>
        <strong data-combo>00</strong>
      </div>
    </section>

    <section class="stage" aria-label="Whack Mole play area">
      <section class="board" data-board aria-label="Whack Mole board"></section>
      <div class="overlay" data-overlay aria-live="polite">
        <strong data-status-title>READY</strong>
        <span data-status-help>SPACE TO START</span>
      </div>
    </section>
  </main>
`;

const shell = queryElement<HTMLElement>('[data-shell]');
const board = queryElement<HTMLElement>('[data-board]');
const overlay = queryElement<HTMLElement>('[data-overlay]');
const statusTitle = queryElement<HTMLElement>('[data-status-title]');
const statusHelp = queryElement<HTMLElement>('[data-status-help]');
const scoreElement = queryElement<HTMLElement>('[data-score]');
const bestElement = queryElement<HTMLElement>('[data-best]');
const timeElement = queryElement<HTMLElement>('[data-time]');
const lifeElement = queryElement<HTMLElement>('[data-life]');
const levelElement = queryElement<HTMLElement>('[data-level]');
const comboElement = queryElement<HTMLElement>('[data-combo]');
const toggleButton = queryElement<HTMLButtonElement>('[data-action="toggle"]');
const restartButton = queryElement<HTMLButtonElement>('[data-action="restart"]');
const holeButtons: HTMLButtonElement[] = [];

createBoard();

toggleButton.addEventListener('click', togglePlay);
restartButton.addEventListener('click', restartGame);
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('message', handleHubMessage);
window.parent.postMessage({ type: 'minigame:ready', gameSlug: GAME_SLUG }, '*');

render();

function createBoard(): void {
  board.innerHTML = '';
  holeButtons.length = 0;

  for (let index = 0; index < state.holes; index += 1) {
    const button = document.createElement('button');
    button.className = 'hole';
    button.type = 'button';
    button.dataset.hole = String(index);
    button.addEventListener('click', () => whack(index));
    board.append(button);
    holeButtons.push(button);
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.code === 'Space') {
    event.preventDefault();
    togglePlay();
    return;
  }

  if (event.code === 'Enter') {
    event.preventDefault();
    restartGame();
    return;
  }

  const key = event.key.length === 1 ? event.key : event.code.replace('Digit', '');
  const hole = getKeyboardHole(key);

  if (hole !== null) {
    event.preventDefault();
    whack(hole);
  }
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

  if (action === 'gameOver') {
    finishGameFromHub();
    return;
  }

  restartGame();
}

function whack(hole: number): void {
  if (state.phase === 'ready') {
    play();
    return;
  }

  if (state.phase !== 'playing') {
    return;
  }

  const previousScore = state.score;
  state = whackHole(state, hole);
  lastHitHole = hole;
  persistBestScore(state.bestScore);
  render();

  window.setTimeout(() => {
    if (lastHitHole === hole) {
      lastHitHole = null;
      render();
    }
  }, 120);

  if (state.score > previousScore) {
    board.dataset.hit = 'true';
    window.setTimeout(() => {
      delete board.dataset.hit;
    }, 120);
  }

  if (state.phase === 'game-over') {
    cancelLoop();
    postGameOver();
  }
}

function togglePlay(): void {
  if (state.phase === 'playing') {
    pause();
    return;
  }

  if (state.phase === 'game-over' || state.phase === 'finished') {
    restartGame();
  }

  play();
}

function play(): void {
  if (state.phase === 'paused') {
    state = resumeGame(state);
  } else {
    state = startGame(state);
  }

  render();

  if (state.phase === 'playing') {
    requestLoop();
    window.parent.postMessage({ type: 'minigame:start', gameSlug: GAME_SLUG }, '*');
  }
}

function pause(): void {
  cancelLoop();
  state = pauseGame(state);
  render();
  window.parent.postMessage({ type: 'minigame:pause', gameSlug: GAME_SLUG }, '*');
}

function restartGame(): void {
  cancelLoop();
  state = createGameState(readBestScore());
  lastFrameTime = 0;
  lastHitHole = null;
  render();
}

function finishGameFromHub(): void {
  cancelLoop();
  state = forceGameOver(state);
  persistBestScore(state.bestScore);
  render();
}

function requestLoop(): void {
  if (frameId !== null) {
    return;
  }

  lastFrameTime = performance.now();
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

  const deltaMs = Math.min(80, time - lastFrameTime);
  lastFrameTime = time;
  state = tickGame(state, deltaMs);
  persistBestScore(state.bestScore);
  render();

  if (state.phase === 'game-over' || state.phase === 'finished') {
    postGameOver();
    return;
  }

  frameId = window.requestAnimationFrame(tick);
}

function render(): void {
  shell.dataset.phase = state.phase;
  scoreElement.textContent = formatScore(state.score);
  bestElement.textContent = formatScore(state.bestScore);
  timeElement.textContent = String(Math.ceil(state.remainingGameMs / 1000)).padStart(2, '0');
  lifeElement.textContent = String(state.lives).padStart(2, '0');
  levelElement.textContent = String(state.level).padStart(2, '0');
  comboElement.textContent = String(state.combo).padStart(2, '0');
  toggleButton.textContent = getToggleLabel(state);
  overlay.hidden = state.phase === 'playing';
  statusTitle.textContent = getStatusTitle(state);
  statusHelp.textContent = getStatusHelp(state);
  renderHoles();
}

function renderHoles(): void {
  const moleByHole = new Map(state.moles.map((mole) => [mole.hole, mole]));

  for (const [index, button] of holeButtons.entries()) {
    const mole = moleByHole.get(index);
    const isHit = lastHitHole === index;

    button.className = [
      'hole',
      mole ? 'is-active' : '',
      mole?.kind === 'gold' ? 'is-gold' : '',
      isHit ? 'is-hit' : '',
    ]
      .filter(Boolean)
      .join(' ');
    button.disabled = state.phase !== 'playing' && state.phase !== 'ready';
    button.textContent = mole ? getMoleLabel(mole) : String(index + 1);
    button.setAttribute('aria-label', mole ? `${mole.kind} mole in hole ${index + 1}` : `empty hole ${index + 1}`);
  }
}

function getMoleLabel(mole: Mole): string {
  const ratio = Math.max(0, mole.remainingMs / getMoleLifetimeMs(state.level));
  const prefix = mole.kind === 'gold' ? 'GOLD' : 'MOLE';
  return `${prefix} ${Math.ceil(ratio * 100)}`;
}

function getToggleLabel(current: WhackMoleState): string {
  if (current.phase === 'playing') {
    return 'Pause';
  }

  if (current.phase === 'game-over' || current.phase === 'finished') {
    return 'Retry';
  }

  return 'Start';
}

function getStatusTitle(current: WhackMoleState): string {
  if (current.phase === 'paused') {
    return 'PAUSED';
  }

  if (current.phase === 'game-over') {
    return 'GAME OVER';
  }

  if (current.phase === 'finished') {
    return 'CLEAR';
  }

  return 'READY';
}

function getStatusHelp(current: WhackMoleState): string {
  if (current.phase === 'paused') {
    return 'SPACE TO RESUME';
  }

  if (current.phase === 'game-over' || current.phase === 'finished') {
    return 'ENTER TO RESET';
  }

  return 'CLICK OR 1-9';
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

function postGameOver(): void {
  window.parent.postMessage(
    {
      type: 'minigame:game-over',
      gameSlug: GAME_SLUG,
      score: state.score,
    },
    '*',
  );
}

function queryElement<T extends HTMLElement>(selector: string): T {
  const element = appRoot.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Element was not found: ${selector}`);
  }

  return element;
}

function getHubAction(value: unknown): 'start' | 'pause' | 'gameOver' | 'reset' | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const message = value as {
    action?: unknown;
    command?: unknown;
    gameSlug?: unknown;
    slug?: unknown;
    source?: unknown;
    type?: unknown;
  };
  const targetSlug = message.gameSlug ?? message.slug;

  if (targetSlug && targetSlug !== GAME_SLUG) {
    return null;
  }

  const action = message.action ?? message.command;

  if (
    message.source === 'minigame-hub' &&
    (action === 'start' || action === 'pause' || action === 'gameOver')
  ) {
    return action;
  }

  if (
    message.type === 'minigame:control' &&
    (action === 'start' || action === 'pause' || action === 'reset')
  ) {
    return action;
  }

  return null;
}
