import {
  clearInput,
  createGameState,
  deleteCharacter,
  forceGameOver,
  pauseGame,
  resumeGame,
  startGame,
  submitInput,
  tickGame,
  type TypeRainState,
  typeCharacter,
} from './game';
import './styles.css';

const GAME_SLUG = 'type-rain';
const BEST_SCORE_KEY = 'minigame:type-rain:best-score';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;

let state = createGameState(readBestScore());
let frameId: number | null = null;
let lastFrameTime = 0;

appRoot.innerHTML = `
  <main class="shell" data-shell>
    <header class="topbar">
      <div class="brand">
        <p>TYPE RAIN</p>
        <h1>Type Rain</h1>
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
        <span>LEVEL</span>
        <strong data-level>01</strong>
      </div>
      <div>
        <span>LIFE</span>
        <strong data-life>03</strong>
      </div>
      <div>
        <span>STREAK</span>
        <strong data-streak>00</strong>
      </div>
    </section>

    <section class="stage" aria-label="Type Rain play area">
      <section class="playfield" data-playfield aria-label="Type Rain playfield"></section>
      <div class="overlay" data-overlay aria-live="polite">
        <strong data-status-title>READY</strong>
        <span data-status-help>SPACE TO START</span>
      </div>
    </section>

    <section class="input-panel" aria-label="Current input">
      <span>INPUT</span>
      <strong data-input>READY</strong>
    </section>
  </main>
`;

const shell = queryElement<HTMLElement>('[data-shell]');
const playfield = queryElement<HTMLElement>('[data-playfield]');
const overlay = queryElement<HTMLElement>('[data-overlay]');
const statusTitle = queryElement<HTMLElement>('[data-status-title]');
const statusHelp = queryElement<HTMLElement>('[data-status-help]');
const scoreElement = queryElement<HTMLElement>('[data-score]');
const bestElement = queryElement<HTMLElement>('[data-best]');
const levelElement = queryElement<HTMLElement>('[data-level]');
const lifeElement = queryElement<HTMLElement>('[data-life]');
const streakElement = queryElement<HTMLElement>('[data-streak]');
const inputElement = queryElement<HTMLElement>('[data-input]');
const toggleButton = queryElement<HTMLButtonElement>('[data-action="toggle"]');
const restartButton = queryElement<HTMLButtonElement>('[data-action="restart"]');

toggleButton.addEventListener('click', togglePlay);
restartButton.addEventListener('click', restartGame);
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('message', handleHubMessage);
window.parent.postMessage({ type: 'minigame:ready', gameSlug: GAME_SLUG }, '*');

render();

function handleKeyDown(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    togglePlay();
    return;
  }

  if (event.code === 'Enter') {
    event.preventDefault();
    submitCurrentInput();
    return;
  }

  if (event.code === 'Backspace') {
    event.preventDefault();
    state = deleteCharacter(state);
    render();
    return;
  }

  if (event.code === 'Escape') {
    event.preventDefault();
    state = clearInput(state);
    render();
    return;
  }

  if (event.key.length === 1 && /^[a-zA-Z]$/.test(event.key)) {
    event.preventDefault();
    state = typeCharacter(state, event.key);
    render();
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

function submitCurrentInput(): void {
  if (state.phase === 'ready') {
    play();
    return;
  }

  const beforeScore = state.score;
  state = submitInput(state);
  persistBestScore(state.bestScore);
  render();

  if (state.score > beforeScore) {
    playfield.dataset.hit = 'true';
    window.setTimeout(() => {
      delete playfield.dataset.hit;
    }, 120);
  }
}

function togglePlay(): void {
  if (state.phase === 'playing') {
    pause();
    return;
  }

  if (state.phase === 'game-over') {
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

  if (state.phase === 'game-over') {
    postGameOver();
    return;
  }

  frameId = window.requestAnimationFrame(tick);
}

function render(): void {
  shell.dataset.phase = state.phase;
  scoreElement.textContent = formatScore(state.score);
  bestElement.textContent = formatScore(state.bestScore);
  levelElement.textContent = String(state.level).padStart(2, '0');
  lifeElement.textContent = String(state.lives).padStart(2, '0');
  streakElement.textContent = String(state.streak).padStart(2, '0');
  inputElement.textContent = state.input || getInputPlaceholder(state);
  toggleButton.textContent = getToggleLabel(state);
  overlay.hidden = state.phase === 'playing';
  statusTitle.textContent = getStatusTitle(state);
  statusHelp.textContent = getStatusHelp(state);
  renderWords();
}

function renderWords(): void {
  const input = state.input;
  playfield.innerHTML = '';

  for (const word of state.words) {
    const element = document.createElement('span');
    element.className = 'word';
    element.classList.toggle('is-target', input.length > 0 && word.text.startsWith(input));
    element.textContent = word.text;
    element.style.left = `${word.x * 100}%`;
    element.style.top = `${word.y * 100}%`;
    playfield.append(element);
  }
}

function getToggleLabel(current: TypeRainState): string {
  if (current.phase === 'playing') {
    return 'Pause';
  }

  if (current.phase === 'game-over') {
    return 'Retry';
  }

  return 'Start';
}

function getStatusTitle(current: TypeRainState): string {
  if (current.phase === 'paused') {
    return 'PAUSED';
  }

  if (current.phase === 'game-over') {
    return 'GAME OVER';
  }

  return 'READY';
}

function getStatusHelp(current: TypeRainState): string {
  if (current.phase === 'paused') {
    return 'SPACE TO RESUME';
  }

  if (current.phase === 'game-over') {
    return 'ENTER TO RESET';
  }

  return 'TYPE WORDS';
}

function getInputPlaceholder(current: TypeRainState): string {
  if (current.phase === 'ready') {
    return 'READY';
  }

  if (current.phase === 'game-over') {
    return 'DONE';
  }

  return '_';
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
