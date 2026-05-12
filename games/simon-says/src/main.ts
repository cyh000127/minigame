import {
  createGameState,
  finishShowing,
  forceGameOver,
  getCueDurationMs,
  getCueGapMs,
  getKeyboardPad,
  getSpeedLevel,
  pauseGame,
  pressPad,
  resumeGame,
  startGame,
  type PadId,
  type SimonState,
} from './game';
import './styles.css';

const GAME_SLUG = 'simon-says';
const BEST_SCORE_KEY = 'minigame:simon-says:best-score';
const PAD_META: Readonly<Record<PadId, { label: string; key: string }>> = {
  up: { label: 'UP', key: 'W' },
  right: { label: 'RIGHT', key: 'D' },
  down: { label: 'DOWN', key: 'S' },
  left: { label: 'LEFT', key: 'A' },
};
const PAD_FREQUENCIES: Readonly<Record<PadId, number>> = {
  up: 523.25,
  right: 659.25,
  down: 783.99,
  left: 392,
};

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;

let state = createGameState(readBestScore());
let activePad: PadId | null = null;
let cueIndex = 0;
let audioContext: AudioContext | null = null;
const timers = new Set<number>();

appRoot.innerHTML = `
  <main class="shell" data-shell>
    <header class="topbar">
      <div class="brand">
        <p>SIMON SAYS</p>
        <h1>Simon Says</h1>
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
        <span>ROUND</span>
        <strong data-round>00</strong>
      </div>
      <div>
        <span>BEST</span>
        <strong data-best>0000</strong>
      </div>
      <div>
        <span>SPEED</span>
        <strong data-speed>01</strong>
      </div>
      <div>
        <span>MODE</span>
        <strong data-mode>FWD</strong>
      </div>
    </section>

    <section class="stage" aria-label="Simon Says play area">
      <section class="pads" aria-label="Simon pads">
        ${(['up', 'left', 'right', 'down'] as const)
          .map((pad) => {
            const meta = PAD_META[pad];
            return `
              <button class="pad pad--${pad}" data-pad="${pad}" type="button">
                <span>${meta.label}</span>
                <small>${meta.key}</small>
              </button>
            `;
          })
          .join('')}
      </section>
      <div class="overlay" data-overlay aria-live="polite">
        <strong data-status-title>READY</strong>
        <span data-status-help>SPACE TO START</span>
      </div>
    </section>
  </main>
`;

const shell = queryElement<HTMLElement>('[data-shell]');
const scoreElement = queryElement<HTMLElement>('[data-score]');
const roundElement = queryElement<HTMLElement>('[data-round]');
const bestElement = queryElement<HTMLElement>('[data-best]');
const speedElement = queryElement<HTMLElement>('[data-speed]');
const modeElement = queryElement<HTMLElement>('[data-mode]');
const overlay = queryElement<HTMLElement>('[data-overlay]');
const statusTitle = queryElement<HTMLElement>('[data-status-title]');
const statusHelp = queryElement<HTMLElement>('[data-status-help]');
const toggleButton = queryElement<HTMLButtonElement>('[data-action="toggle"]');
const restartButton = queryElement<HTMLButtonElement>('[data-action="restart"]');
const padButtons = new Map<PadId, HTMLButtonElement>();

for (const button of appRoot.querySelectorAll<HTMLButtonElement>('[data-pad]')) {
  const pad = button.dataset.pad;

  if (isPadId(pad)) {
    padButtons.set(pad, button);
    button.addEventListener('click', () => handlePadInput(pad));
  }
}

toggleButton.addEventListener('click', togglePlay);
restartButton.addEventListener('click', restartGame);
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('message', handleHubMessage);
window.parent.postMessage({ type: 'minigame:ready', gameSlug: GAME_SLUG }, '*');

render();

function handleKeyDown(event: KeyboardEvent): void {
  const pad = getKeyboardPad(event.code) ?? getKeyboardPad(event.key);

  if (pad) {
    event.preventDefault();
    handlePadInput(pad);
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

function handlePadInput(pad: PadId): void {
  unlockAudio();

  if (state.phase === 'ready') {
    play();
    return;
  }

  if (state.phase !== 'input') {
    return;
  }

  const previousScore = state.score;
  state = pressPad(state, pad);
  persistBestScore(state.bestScore);
  playPadTone(pad, state.phase === 'game-over' ? 0.18 : 0.09);
  pulsePad(pad, state.phase === 'game-over' ? 'wrong' : 'manual');
  render();

  if (state.phase === 'game-over') {
    postGameOver();
    return;
  }

  if (state.phase === 'showing') {
    scheduleTimer(() => {
      playSequence();
    }, previousScore === state.score ? 0 : 420);
  }
}

function togglePlay(): void {
  if (state.phase === 'showing' || state.phase === 'input') {
    pause();
    return;
  }

  if (state.phase === 'game-over') {
    restartGame();
  }

  play();
}

function play(): void {
  unlockAudio();

  if (state.phase === 'paused') {
    state = resumeGame(state);
  } else {
    state = startGame(state);
  }

  render();

  if (state.phase === 'showing') {
    playSequence();
  }

  if (state.phase === 'input') {
    window.parent.postMessage({ type: 'minigame:start', gameSlug: GAME_SLUG }, '*');
  }
}

function pause(): void {
  clearTimers();
  activePad = null;
  state = pauseGame(state);
  render();
  window.parent.postMessage({ type: 'minigame:pause', gameSlug: GAME_SLUG }, '*');
}

function restartGame(): void {
  clearTimers();
  activePad = null;
  cueIndex = 0;
  state = createGameState(readBestScore());
  render();
}

function finishGameFromHub(): void {
  clearTimers();
  activePad = null;
  state = forceGameOver(state);
  persistBestScore(state.bestScore);
  render();
}

function playSequence(): void {
  clearTimers();

  if (state.phase !== 'showing') {
    render();
    return;
  }

  cueIndex = 0;
  render();
  scheduleTimer(showNextCue, 260);
  window.parent.postMessage({ type: 'minigame:start', gameSlug: GAME_SLUG }, '*');
}

function showNextCue(): void {
  if (state.phase !== 'showing') {
    activePad = null;
    render();
    return;
  }

  const pad = state.sequence[cueIndex];

  if (!pad) {
    activePad = null;
    cueIndex = 0;
    state = finishShowing(state);
    render();
    return;
  }

  activePad = pad;
  playPadTone(pad, 0.14);
  render();

  scheduleTimer(() => {
    activePad = null;
    cueIndex += 1;
    render();
    scheduleTimer(showNextCue, getCueGapMs(state.round));
  }, getCueDurationMs(state.round));
}

function pulsePad(pad: PadId, mode: 'manual' | 'wrong'): void {
  activePad = pad;
  render();
  const duration = mode === 'wrong' ? 360 : 130;

  scheduleTimer(() => {
    if (state.phase !== 'showing') {
      activePad = null;
      render();
    }
  }, duration);
}

function render(): void {
  shell.dataset.phase = state.phase;
  scoreElement.textContent = formatScore(state.score);
  roundElement.textContent = String(state.round).padStart(2, '0');
  bestElement.textContent = formatScore(state.bestScore);
  speedElement.textContent = String(getSpeedLevel(Math.max(1, state.round))).padStart(2, '0');
  modeElement.textContent = state.inputMode === 'reverse' ? 'REV' : 'FWD';
  toggleButton.textContent = getToggleLabel(state);
  overlay.hidden = state.phase === 'input' || state.phase === 'showing';
  statusTitle.textContent = getStatusTitle(state);
  statusHelp.textContent = getStatusHelp(state);

  for (const [pad, button] of padButtons) {
    button.classList.toggle('is-active', activePad === pad);
    button.disabled = state.phase !== 'input' && state.phase !== 'ready';
    button.setAttribute('aria-pressed', activePad === pad ? 'true' : 'false');
  }
}

function getToggleLabel(current: SimonState): string {
  if (current.phase === 'showing' || current.phase === 'input') {
    return 'Pause';
  }

  if (current.phase === 'game-over') {
    return 'Retry';
  }

  return 'Start';
}

function getStatusTitle(current: SimonState): string {
  if (current.phase === 'paused') {
    return 'PAUSED';
  }

  if (current.phase === 'game-over') {
    return 'GAME OVER';
  }

  return 'READY';
}

function getStatusHelp(current: SimonState): string {
  if (current.phase === 'paused') {
    return 'SPACE TO RESUME';
  }

  if (current.phase === 'game-over') {
    return 'ENTER TO RESET';
  }

  return 'WATCH THE PATTERN';
}

function unlockAudio(): void {
  audioContext ??= new AudioContext();

  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
}

function playPadTone(pad: PadId, durationSeconds: number): void {
  if (!audioContext) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = 'sine';
  oscillator.frequency.value = PAD_FREQUENCIES[pad];
  gain.gain.setValueAtTime(0.045, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + durationSeconds);
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

function scheduleTimer(callback: () => void, delay: number): void {
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    callback();
  }, delay);
  timers.add(timer);
}

function clearTimers(): void {
  for (const timer of timers) {
    window.clearTimeout(timer);
  }

  timers.clear();
}

function queryElement<T extends HTMLElement>(selector: string): T {
  const element = appRoot.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Element was not found: ${selector}`);
  }

  return element;
}

function isPadId(value: string | undefined): value is PadId {
  return value === 'up' || value === 'right' || value === 'down' || value === 'left';
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
