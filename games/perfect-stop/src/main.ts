import {
  ROUND_LIMIT,
  advanceRound,
  createGameState,
  forceGameOver,
  getCursorSpeed,
  getResultLabel,
  pauseGame,
  resumeGame,
  startGame,
  stopCursor,
  tickGame,
  type PerfectStopState,
} from './game';
import './styles.css';

const GAME_SLUG = 'perfect-stop';
const BEST_SCORE_KEY = 'minigame:perfect-stop:best-score';
const FEEDBACK_DELAY_MS = 850;

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;

let state = createGameState(readBestScore());
let frameId: number | null = null;
let lastFrameTime = 0;
let feedbackTimer: number | null = null;

appRoot.innerHTML = `
  <main class="shell" data-shell>
    <header class="topbar">
      <div class="brand">
        <p>PERFECT STOP</p>
        <h1>Perfect Stop</h1>
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
        <span>ROUND</span>
        <strong data-round>00</strong>
      </div>
      <div>
        <span>LIFE</span>
        <strong data-life>03</strong>
      </div>
      <div>
        <span>STREAK</span>
        <strong data-streak>00</strong>
      </div>
      <div>
        <span>SPEED</span>
        <strong data-speed>0.42</strong>
      </div>
    </section>

    <section class="stage" aria-label="Perfect Stop play area">
      <section class="meter" data-meter aria-label="Timing meter">
        <span class="bonus-zone" data-bonus-zone="0"></span>
        <span class="bonus-zone" data-bonus-zone="1"></span>
        <span class="zone" data-zone></span>
        <span class="center-line" aria-hidden="true"></span>
        <span class="cursor" data-cursor></span>
      </section>
      <div class="feedback" data-feedback aria-live="polite">
        <strong data-status-title>READY</strong>
        <span data-status-help>SPACE TO START</span>
      </div>
    </section>
  </main>
`;

const shell = queryElement<HTMLElement>('[data-shell]');
const meter = queryElement<HTMLElement>('[data-meter]');
const zoneElement = queryElement<HTMLElement>('[data-zone]');
const bonusZoneElements = Array.from(appRoot.querySelectorAll<HTMLElement>('[data-bonus-zone]'));
const cursorElement = queryElement<HTMLElement>('[data-cursor]');
const scoreElement = queryElement<HTMLElement>('[data-score]');
const bestElement = queryElement<HTMLElement>('[data-best]');
const roundElement = queryElement<HTMLElement>('[data-round]');
const lifeElement = queryElement<HTMLElement>('[data-life]');
const streakElement = queryElement<HTMLElement>('[data-streak]');
const speedElement = queryElement<HTMLElement>('[data-speed]');
const feedback = queryElement<HTMLElement>('[data-feedback]');
const statusTitle = queryElement<HTMLElement>('[data-status-title]');
const statusHelp = queryElement<HTMLElement>('[data-status-help]');
const toggleButton = queryElement<HTMLButtonElement>('[data-action="toggle"]');
const restartButton = queryElement<HTMLButtonElement>('[data-action="restart"]');

toggleButton.addEventListener('click', togglePlay);
restartButton.addEventListener('click', restartGame);
meter.addEventListener('click', handleStopInput);
meter.addEventListener('pointerdown', (event) => {
  event.preventDefault();
});
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('message', handleHubMessage);
window.parent.postMessage({ type: 'minigame:ready', gameSlug: GAME_SLUG }, '*');

render();

function handleKeyDown(event: KeyboardEvent): void {
  if (event.code === 'Space') {
    event.preventDefault();
    if (state.phase === 'playing') {
      handleStopInput();
      return;
    }

    togglePlay();
    return;
  }

  if (event.code === 'Enter') {
    event.preventDefault();
    restartGame();
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

function handleStopInput(): void {
  if (state.phase === 'ready') {
    play();
    return;
  }

  if (state.phase !== 'playing') {
    return;
  }

  cancelLoop();
  state = stopCursor(state);
  persistBestScore(state.bestScore);
  render();

  if (state.phase === 'feedback') {
    scheduleFeedbackAdvance();
    return;
  }

  if (state.phase === 'game-over' || state.phase === 'finished') {
    postGameOver();
  }
}

function togglePlay(): void {
  if (state.phase === 'playing' || state.phase === 'feedback') {
    pause();
    return;
  }

  if (state.phase === 'game-over' || state.phase === 'finished') {
    restartGame();
  }

  play();
}

function play(): void {
  clearFeedbackTimer();

  if (state.phase === 'paused') {
    state = resumeGame(state);
  } else {
    state = startGame(state);
  }

  render();

  if (state.phase === 'playing') {
    requestLoop();
    window.parent.postMessage({ type: 'minigame:start', gameSlug: GAME_SLUG }, '*');
    return;
  }

  if (state.phase === 'feedback') {
    scheduleFeedbackAdvance();
  }
}

function pause(): void {
  cancelLoop();
  clearFeedbackTimer();
  state = pauseGame(state);
  render();
  window.parent.postMessage({ type: 'minigame:pause', gameSlug: GAME_SLUG }, '*');
}

function restartGame(): void {
  cancelLoop();
  clearFeedbackTimer();
  state = createGameState(readBestScore());
  lastFrameTime = 0;
  render();
}

function finishGameFromHub(): void {
  cancelLoop();
  clearFeedbackTimer();
  state = forceGameOver(state);
  persistBestScore(state.bestScore);
  render();
}

function scheduleFeedbackAdvance(): void {
  clearFeedbackTimer();
  feedbackTimer = window.setTimeout(() => {
    feedbackTimer = null;
    state = advanceRound(state);
    render();

    if (state.phase === 'playing') {
      requestLoop();
    }
  }, FEEDBACK_DELAY_MS);
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

  const deltaMs = Math.min(64, time - lastFrameTime);
  lastFrameTime = time;
  state = tickGame(state, deltaMs);
  render();
  frameId = window.requestAnimationFrame(tick);
}

function render(): void {
  shell.dataset.phase = state.phase;
  zoneElement.style.left = `${(state.target.center - state.target.width / 2) * 100}%`;
  zoneElement.style.width = `${state.target.width * 100}%`;
  bonusZoneElements.forEach((element, index) => {
    const zone = state.bonusZones[index];

    element.hidden = !zone;

    if (!zone) {
      return;
    }

    element.style.left = `${(zone.center - zone.width / 2) * 100}%`;
    element.style.width = `${zone.width * 100}%`;
  });
  cursorElement.style.left = `${state.cursor * 100}%`;
  scoreElement.textContent = formatScore(state.score);
  bestElement.textContent = formatScore(state.bestScore);
  roundElement.textContent = `${String(state.round).padStart(2, '0')}/${ROUND_LIMIT}`;
  lifeElement.textContent = String(state.lives).padStart(2, '0');
  streakElement.textContent = String(state.streak).padStart(2, '0');
  speedElement.textContent = getCursorSpeed(Math.max(1, state.round)).toFixed(2);
  toggleButton.textContent = getToggleLabel(state);
  feedback.hidden = state.phase === 'playing';
  statusTitle.textContent = getStatusTitle(state);
  statusHelp.textContent = getStatusHelp(state);
}

function getToggleLabel(current: PerfectStopState): string {
  if (current.phase === 'playing' || current.phase === 'feedback') {
    return 'Pause';
  }

  if (current.phase === 'game-over' || current.phase === 'finished') {
    return 'Retry';
  }

  return 'Start';
}

function getStatusTitle(current: PerfectStopState): string {
  if (current.phase === 'paused') {
    return 'PAUSED';
  }

  if (current.phase === 'game-over') {
    return 'GAME OVER';
  }

  if (current.phase === 'finished') {
    return 'CLEAR';
  }

  if (current.phase === 'feedback') {
    return getResultLabel(current.lastResult);
  }

  return 'READY';
}

function getStatusHelp(current: PerfectStopState): string {
  if (current.phase === 'paused') {
    return 'SPACE TO RESUME';
  }

  if (current.phase === 'game-over' || current.phase === 'finished') {
    return 'ENTER TO RESET';
  }

  if (current.phase === 'feedback') {
    const points = current.lastResult?.points ?? 0;
    return points > 0 ? `+${points} POINTS${current.lastResult?.bonus ? ' BONUS' : ''}` : 'NEXT ROUND';
  }

  return 'SPACE / CLICK';
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

function clearFeedbackTimer(): void {
  if (feedbackTimer === null) {
    return;
  }

  window.clearTimeout(feedbackTimer);
  feedbackTimer = null;
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
