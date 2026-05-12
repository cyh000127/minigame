import './styles.css';
import {
  CARD_COUNT,
  createGameState,
  forceGameOver,
  getKeyboardCardIndex,
  pauseGame,
  resolveSelection,
  resumeGame,
  selectCard,
  startGame,
  tickGame,
  type CardSymbol,
  type GamePhase,
  type MemoryFlipState,
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

const BEST_SCORE_KEY = 'minigame:memory-flip:best-score';
const RESOLVE_DELAY_MS = 650;
const CARD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Q', 'W', 'E', 'A', 'S', 'D', 'F'];
const SYMBOL_LABELS: Record<CardSymbol, string> = {
  SUN: 'SUN',
  MOON: 'MOON',
  STAR: 'STAR',
  COMET: 'COMET',
  CROWN: 'CROWN',
  HEART: 'HEART',
  BOLT: 'BOLT',
  GEM: 'GEM',
};

let state: MemoryFlipState = createGameState(Math.random, loadBestScore());
let frameId: number | null = null;
let lastFrameTime: number | null = null;
let resolveTimerId: number | null = null;

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div>
        <p>MEMORY FLIP</p>
        <h1>Memory Flip</h1>
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
        <span>MOVES</span>
        <strong data-moves>00</strong>
      </div>
      <div>
        <span>MATCH</span>
        <strong data-matches>0/8</strong>
      </div>
      <div>
        <span>TIME</span>
        <strong data-time>90</strong>
      </div>
      <div>
        <span>COMBO</span>
        <strong data-combo>x0</strong>
      </div>
    </section>

    <section class="board" aria-label="Memory Flip board">
      ${Array.from({ length: CARD_COUNT }, (_, index) => `<button class="card" type="button" data-card-id="${index}" aria-label="Card ${index + 1}">${CARD_KEYS[index]}</button>`).join('')}
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
const movesText = requireElement<HTMLElement>('[data-moves]');
const matchesText = requireElement<HTMLElement>('[data-matches]');
const timeText = requireElement<HTMLElement>('[data-time]');
const comboText = requireElement<HTMLElement>('[data-combo]');
const statusText = requireElement<HTMLElement>('[data-status]');
const substatusText = requireElement<HTMLElement>('[data-substatus]');
const cardButtons = Array.from(app.querySelectorAll<HTMLButtonElement>('[data-card-id]'));

const runtime: MiniGameLifecycle = {
  start() {
    if (state.phase === 'won' || state.phase === 'game-over') {
      resetGame(true);
      return;
    }

    if (state.phase === 'paused') {
      state = resumeGame(state);
    } else {
      state = startGame(state);
    }

    if (state.phase === 'checking') {
      scheduleResolveSelection();
    }

    render();
    ensureLoop();
  },
  pause() {
    state = pauseGame(state);
    clearResolveTimer();
    stopLoop();
    render();
  },
  gameOver() {
    state = forceGameOver(state);
    clearResolveTimer();
    stopLoop();
    saveBestScore(state.bestScore);
    render();
  },
};

primaryButton.addEventListener('click', () => {
  if (state.phase === 'playing' || state.phase === 'checking') {
    runtime.pause();
    return;
  }

  runtime.start();
});

resetButton.addEventListener('click', () => {
  resetGame(true);
});

cardButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectCardByIndex(Number(button.dataset.cardId));
  });
});

window.addEventListener('keydown', (event) => {
  if (event.repeat) {
    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();

    if (state.phase === 'playing' || state.phase === 'checking') {
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

  const cardIndex = getKeyboardCardIndex(event.code) ?? getKeyboardCardIndex(event.key);

  if (cardIndex !== null) {
    event.preventDefault();
    selectCardByIndex(cardIndex);
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

function selectCardByIndex(index: number): void {
  if (index < 0 || index >= state.cards.length) {
    return;
  }

  if (state.phase !== 'playing') {
    return;
  }

  state = selectCard(state, state.cards[index].id);
  saveBestScore(state.bestScore);
  render();

  if (state.phase === 'checking') {
    scheduleResolveSelection();
  }

  ensureLoop();
}

function scheduleResolveSelection(): void {
  clearResolveTimer();

  resolveTimerId = window.setTimeout(() => {
    resolveTimerId = null;
    state = resolveSelection(state);
    render();
    ensureLoop();
  }, RESOLVE_DELAY_MS);
}

function clearResolveTimer(): void {
  if (resolveTimerId === null) {
    return;
  }

  window.clearTimeout(resolveTimerId);
  resolveTimerId = null;
}

function ensureLoop(): void {
  if (frameId !== null || (state.phase !== 'playing' && state.phase !== 'checking')) {
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

  if (state.phase !== 'playing' && state.phase !== 'checking') {
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

  if (state.phase === 'playing' || state.phase === 'checking') {
    frameId = window.requestAnimationFrame(loop);
  } else {
    lastFrameTime = null;
    clearResolveTimer();
  }
}

function resetGame(shouldStart: boolean): void {
  clearResolveTimer();
  stopLoop();
  state = createGameState(Math.random, Math.max(state.bestScore, loadBestScore()));

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
  movesText.textContent = state.moves.toString().padStart(2, '0');
  matchesText.textContent = `${state.matches}/${state.cards.length / 2}`;
  timeText.textContent = formatTime(state.remainingMs);
  comboText.textContent = `x${state.combo}`;
  statusText.textContent = getStatusText(state.phase);
  substatusText.textContent = getSubstatusText(state);
  primaryButton.textContent = getPrimaryButtonText(state.phase);

  state.cards.forEach((card, index) => {
    const button = cardButtons[index];
    const isVisible = card.isFaceUp || card.isMatched;
    const isSelected = state.selectedIds.includes(card.id);
    button.textContent = isVisible ? SYMBOL_LABELS[card.symbol] : CARD_KEYS[index];
    button.disabled =
      state.phase !== 'playing' || isVisible || isSelected || state.selectedIds.length >= 2;
    button.classList.toggle('is-face-up', isVisible);
    button.classList.toggle('is-matched', card.isMatched);
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
  });
}

function formatScore(score: number): string {
  return Math.trunc(score).toString().padStart(4, '0');
}

function formatTime(remainingMs: number): string {
  return Math.ceil(remainingMs / 1000).toString().padStart(2, '0');
}

function getPrimaryButtonText(phase: GamePhase): string {
  if (phase === 'playing' || phase === 'checking') {
    return 'Pause';
  }

  if (phase === 'paused') {
    return 'Resume';
  }

  if (phase === 'won' || phase === 'game-over') {
    return 'Again';
  }

  return 'Start';
}

function getStatusText(phase: GamePhase): string {
  const statusByPhase: Record<GamePhase, string> = {
    ready: 'READY',
    playing: 'PLAY',
    checking: 'CHECK',
    paused: 'PAUSED',
    won: 'CLEAR',
    'game-over': 'TIME UP',
  };

  return statusByPhase[phase];
}

function getSubstatusText(nextState: MemoryFlipState): string {
  if (nextState.phase === 'won') {
    return 'ALL MATCHED';
  }

  if (nextState.phase === 'game-over') {
    return 'TRY AGAIN';
  }

  if (nextState.phase === 'paused') {
    return 'HOLD';
  }

  if (nextState.phase === 'checking') {
    return 'MEMORIZE';
  }

  if (nextState.selectedIds.length === 1) {
    return 'FIND PAIR';
  }

  return 'PICK CARD';
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
