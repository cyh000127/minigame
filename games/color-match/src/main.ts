import './styles.css';
import {
  chooseDirection,
  createReadyState,
  DIRECTION_COLORS,
  getColorMeta,
  getKeyboardDirection,
  getRoundTargetLabel,
  getRuleLabel,
  isFeverActive,
  SETTINGS,
  startGame,
  tickTimer,
  type ColorMatchState,
  type Direction,
} from './game';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;

appRoot.innerHTML = `
  <main class="shell" data-phase="ready">
    <header class="scoreboard" aria-label="Game status">
      <div class="metric">
        <span>SCORE</span>
        <strong data-score>000000</strong>
      </div>
      <div class="metric">
        <span>STREAK</span>
        <strong data-streak>00</strong>
      </div>
      <div class="metric">
        <span>SPEED</span>
        <strong data-speed>01</strong>
      </div>
      <div class="metric metric--fever" data-fever-panel>
        <span>FEVER</span>
        <strong data-fever>OFF</strong>
      </div>
    </header>

    <section class="time-panel" aria-label="Time remaining">
      <div class="time-panel__label">
        <span>TIME</span>
        <strong data-time>4.5</strong>
      </div>
      <div class="gauge">
        <div class="gauge__fill" data-gauge></div>
      </div>
    </section>

    <section class="arena" aria-label="Color Match board">
      ${DIRECTION_COLORS.map(
        (entry) => `
          <button
            class="direction direction--${entry.direction}"
            data-direction="${entry.direction}"
            type="button"
            style="--button-color: ${entry.hex}; --button-text: ${entry.textColor};"
          >
            <span>${entry.keyLabel}</span>
            <strong>${entry.label}</strong>
            <em>${entry.assistLabel}</em>
          </button>
        `,
      ).join('')}

      <div class="target-card" aria-live="polite">
        <p class="rule-badge" data-rule>MATCH</p>
        <div class="character" data-character aria-label="Target character">
          <div class="character__eyes"></div>
          <div class="character__mouth"></div>
        </div>
        <strong class="target-name" data-target-name>RED</strong>
      </div>

      <div class="feedback" data-feedback>PRESS START</div>

      <div class="overlay" data-overlay>
        <p data-overlay-kicker>COLOR MATCH</p>
        <h1 data-overlay-title>READY</h1>
        <strong data-overlay-score></strong>
        <button class="start-button" data-start type="button">START</button>
      </div>
    </section>
  </main>
`;

const shell = mustQuery<HTMLElement>('.shell');
const scoreElement = mustQuery<HTMLElement>('[data-score]');
const streakElement = mustQuery<HTMLElement>('[data-streak]');
const speedElement = mustQuery<HTMLElement>('[data-speed]');
const feverElement = mustQuery<HTMLElement>('[data-fever]');
const feverPanel = mustQuery<HTMLElement>('[data-fever-panel]');
const timeElement = mustQuery<HTMLElement>('[data-time]');
const gaugeElement = mustQuery<HTMLElement>('[data-gauge]');
const ruleElement = mustQuery<HTMLElement>('[data-rule]');
const characterElement = mustQuery<HTMLElement>('[data-character]');
const targetNameElement = mustQuery<HTMLElement>('[data-target-name]');
const feedbackElement = mustQuery<HTMLElement>('[data-feedback]');
const overlayElement = mustQuery<HTMLElement>('[data-overlay]');
const overlayKickerElement = mustQuery<HTMLElement>('[data-overlay-kicker]');
const overlayTitleElement = mustQuery<HTMLElement>('[data-overlay-title]');
const overlayScoreElement = mustQuery<HTMLElement>('[data-overlay-score]');
const startButton = mustQuery<HTMLButtonElement>('[data-start]');
const directionButtons = new Map<Direction, HTMLButtonElement>();

for (const button of appRoot.querySelectorAll<HTMLButtonElement>('[data-direction]')) {
  const direction = button.dataset.direction as Direction;
  directionButtons.set(direction, button);
  button.addEventListener('click', () => handleDirection(direction));
}

let state = createReadyState();
let frameId = 0;
let lastFrameMs = performance.now();

startButton.addEventListener('click', restartGame);

window.addEventListener('keydown', (event) => {
  const direction = getKeyboardDirection(event.key);

  if (direction) {
    event.preventDefault();
    handleDirection(direction);
    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    restartGame();
  }
});

render();

function restartGame(): void {
  state = startGame();
  lastFrameMs = performance.now();
  stopLoop();
  frameId = window.requestAnimationFrame(gameLoop);
  render();
}

function handleDirection(direction: Direction): void {
  if (state.phase !== 'playing') {
    return;
  }

  const wasCorrect = direction === state.round.correctDirection;
  state = chooseDirection(state, direction, performance.now());
  flashDirection(direction, wasCorrect);
  render();

  if (state.phase !== 'playing') {
    stopLoop();
  }
}

function gameLoop(nowMs: number): void {
  const elapsedMs = Math.min(120, nowMs - lastFrameMs);
  lastFrameMs = nowMs;
  state = tickTimer(state, elapsedMs, nowMs);
  render();

  if (state.phase === 'playing') {
    frameId = window.requestAnimationFrame(gameLoop);
  } else {
    stopLoop();
  }
}

function render(): void {
  const targetMeta = getColorMeta(state.round.targetColor);
  const feverActive = isFeverActive(state, performance.now());
  const gaugeRatio = state.maxTimeMs > 0 ? state.timeLeftMs / state.maxTimeMs : 0;

  shell.dataset.phase = state.phase;
  shell.classList.toggle('is-fever', feverActive);
  scoreElement.textContent = state.score.toString().padStart(6, '0');
  streakElement.textContent = state.streak.toString().padStart(2, '0');
  speedElement.textContent = state.speedLevel.toString().padStart(2, '0');
  feverElement.textContent = feverActive ? 'ON' : 'OFF';
  feverPanel.classList.toggle('is-active', feverActive);
  timeElement.textContent = (state.timeLeftMs / 1_000).toFixed(1);
  gaugeElement.style.width = `${Math.max(0, Math.min(1, gaugeRatio)) * 100}%`;
  gaugeElement.classList.toggle('is-low', gaugeRatio < 0.28);
  ruleElement.textContent = getRuleLabel(state.round.rule);
  ruleElement.classList.toggle('is-trap', state.round.rule !== 'match');
  characterElement.style.setProperty('--target-color', targetMeta.hex);
  characterElement.style.setProperty('--target-text', targetMeta.textColor);
  characterElement.style.setProperty('--target-glow', targetMeta.hex);
  targetNameElement.textContent = `${getRoundTargetLabel(state.round)} ${targetMeta.assistLabel}`;
  feedbackElement.textContent = state.feedback.message;

  renderOverlay();
}

function renderOverlay(): void {
  const visible = state.phase !== 'playing';

  overlayElement.classList.toggle('is-hidden', !visible);

  if (state.phase === 'ready') {
    overlayKickerElement.textContent = 'COLOR MATCH';
    overlayTitleElement.textContent = 'READY';
    overlayScoreElement.textContent = '';
    startButton.textContent = 'START';
    return;
  }

  overlayKickerElement.textContent = state.feedback.kind === 'timeout' ? 'TIME OUT' : 'GAME OVER';
  overlayTitleElement.textContent = state.score.toString().padStart(6, '0');
  overlayScoreElement.textContent = `BEST STREAK ${state.bestStreak.toString().padStart(2, '0')}`;
  startButton.textContent = 'RESTART';
}

function flashDirection(direction: Direction, correct: boolean): void {
  const button = directionButtons.get(direction);

  if (!button) {
    return;
  }

  button.classList.remove('is-correct', 'is-wrong');
  void button.offsetWidth;
  button.classList.add(correct ? 'is-correct' : 'is-wrong');

  window.setTimeout(() => {
    button.classList.remove('is-correct', 'is-wrong');
  }, 180);
}

function stopLoop(): void {
  if (!frameId) {
    return;
  }

  window.cancelAnimationFrame(frameId);
  frameId = 0;
}

function mustQuery<TElement extends Element>(selector: string): TElement {
  const element = appRoot.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Missing UI element: ${selector}`);
  }

  return element;
}
