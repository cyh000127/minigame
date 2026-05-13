import './styles.css';
import {
  DIFFICULTIES,
  PEG_INDICES,
  calculateScore,
  choosePeg,
  createInitialState,
  formatTime,
  getLegalDestinations,
  getMinimumMoves,
  getTopDisc,
  isSolved,
  tickTimer,
  type DifficultyId,
  type PegIndex,
} from './game';

type Phase = 'ready' | 'playing' | 'paused' | 'won' | 'stopped';
type HubCommand = 'start' | 'pause' | 'gameOver';

interface HubMessage {
  readonly source?: unknown;
  readonly command?: unknown;
  readonly gameSlug?: unknown;
}

const GAME_SLUG = 'tower-of-hanoi';
const BEST_SCORE_KEY_PREFIX = 'minigame:tower-of-hanoi:best-score';
const DISC_COLORS = [
  ['#fef3c7', '#facc15'],
  ['#bae6fd', '#38bdf8'],
  ['#c7d2fe', '#818cf8'],
  ['#fecdd3', '#fb7185'],
  ['#bbf7d0', '#34d399'],
] as const;

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;
let state = createInitialState('normal');
let phase: Phase = 'ready';
let selectedDifficulty: DifficultyId = state.difficulty.id;
let focusedPeg: PegIndex = 0;
let timerId: number | null = null;

const numberFormat = new Intl.NumberFormat('ko-KR');

render();
notifyParent('minigame:start');

window.addEventListener('keydown', handleKeydown);
window.addEventListener('message', (event: MessageEvent<HubMessage>) => {
  if (event.origin !== window.origin || !isHubMessage(event.data)) {
    return;
  }

  handleHubCommand(event.data.command);
});

appRoot.addEventListener('click', (event) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const difficultyButton = target.closest<HTMLButtonElement>('[data-difficulty]');
  if (difficultyButton?.dataset.difficulty) {
    startGame(difficultyButton.dataset.difficulty as DifficultyId);
    return;
  }

  const actionButton = target.closest<HTMLButtonElement>('[data-action]');
  if (actionButton?.dataset.action) {
    handleAction(actionButton.dataset.action);
    return;
  }

  const pegButton = target.closest<HTMLButtonElement>('[data-peg]');
  const pegIndex = Number(pegButton?.dataset.peg);

  if (pegButton && isPegIndex(pegIndex)) {
    handlePegChoice(pegIndex);
  }
});

function startGame(difficultyId: DifficultyId = selectedDifficulty): void {
  selectedDifficulty = difficultyId;
  state = createInitialState(difficultyId);
  focusedPeg = 0;
  phase = 'playing';
  setTimerRunning(true);
  notifyParent('minigame:start');
  notifyParent('minigame:score', 0);
  render();
}

function pauseGame(): void {
  if (phase !== 'playing') {
    return;
  }

  phase = 'paused';
  setTimerRunning(false);
  render();
}

function resumeGame(): void {
  if (phase !== 'paused') {
    return;
  }

  phase = 'playing';
  setTimerRunning(true);
  render();
}

function stopGame(): void {
  phase = 'stopped';
  state = {
    ...state,
    selectedPeg: null,
  };
  setTimerRunning(false);
  notifyParent('minigame:game-over', calculateCurrentScore());
  render();
}

function handleHubCommand(command: HubCommand): void {
  if (command === 'start') {
    if (phase === 'paused') {
      resumeGame();
      return;
    }

    if (phase !== 'playing') {
      startGame();
    }
    return;
  }

  if (command === 'pause') {
    pauseGame();
    return;
  }

  stopGame();
}

function handleAction(action: string): void {
  if (action === 'new') {
    startGame();
    return;
  }

  if (action === 'pause') {
    if (phase === 'paused') {
      resumeGame();
    } else {
      pauseGame();
    }
  }
}

function handlePegChoice(pegIndex: PegIndex): void {
  if (phase === 'ready' || phase === 'won' || phase === 'stopped') {
    startGame();
  }

  if (phase !== 'playing') {
    return;
  }

  focusedPeg = pegIndex;
  const previousMoves = state.moves;
  state = choosePeg(state, pegIndex);

  if (state.moves !== previousMoves) {
    notifyParent('minigame:score', calculateCurrentScore());
  }

  if (isSolved(state)) {
    completeGame();
    return;
  }

  render();
}

function handleKeydown(event: KeyboardEvent): void {
  const handledKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter', 'n', 'N', 'p', 'P'];

  if (!handledKeys.includes(event.key)) {
    return;
  }

  event.preventDefault();

  if (event.key === 'n' || event.key === 'N') {
    startGame();
    return;
  }

  if (event.key === 'p' || event.key === 'P') {
    handleAction('pause');
    return;
  }

  if (event.key === 'ArrowLeft') {
    focusedPeg = wrapPeg(focusedPeg - 1);
    render();
    return;
  }

  if (event.key === 'ArrowRight') {
    focusedPeg = wrapPeg(focusedPeg + 1);
    render();
    return;
  }

  if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === ' ' || event.key === 'Enter') {
    handlePegChoice(focusedPeg);
  }
}

function completeGame(): void {
  phase = 'won';
  setTimerRunning(false);

  const score = calculateCurrentScore();
  const bestScore = Math.max(score, readBestScore(selectedDifficulty));

  window.localStorage.setItem(createBestScoreKey(selectedDifficulty), String(bestScore));
  notifyParent('minigame:score', score);
  notifyParent('minigame:game-over', score);
  render();
}

function calculateCurrentScore(): number {
  return calculateScore({
    difficultyId: state.difficulty.id,
    moves: state.moves,
    elapsedSeconds: state.elapsedSeconds,
  });
}

function setTimerRunning(shouldRun: boolean): void {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }

  if (!shouldRun) {
    return;
  }

  timerId = window.setInterval(() => {
    if (phase !== 'playing') {
      return;
    }

    state = tickTimer(state, 1);
    notifyParent('minigame:score', calculateCurrentScore());
    render();
  }, 1000);
}

function render(): void {
  const legalDestinations = state.selectedPeg === null
    ? []
    : getLegalDestinations(state.pegs, state.selectedPeg);
  const minimumMoves = getMinimumMoves(state.difficulty.discCount);
  const currentScore = calculateCurrentScore();
  const bestScore = readBestScore(selectedDifficulty);

  appRoot.innerHTML = `
    <main class="game-shell" data-phase="${phase}">
      <header class="topbar">
        <div class="title-block">
          <p class="eyebrow">LOGIC PUZZLE</p>
          <h1>Tower of Hanoi</h1>
        </div>
        <section class="hud" aria-label="Game status">
          <div class="hud__item">
            <span>Time</span>
            <strong>${formatTime(state.elapsedSeconds)}</strong>
          </div>
          <div class="hud__item">
            <span>Moves</span>
            <strong>${state.moves}/${minimumMoves}</strong>
          </div>
          <div class="hud__item">
            <span>Score</span>
            <strong>${numberFormat.format(currentScore)}</strong>
          </div>
          <div class="hud__item">
            <span>Best</span>
            <strong>${numberFormat.format(bestScore)}</strong>
          </div>
        </section>
      </header>

      <section class="playfield" aria-label="Tower of Hanoi game">
        <section class="board-panel">
          <div class="board-head">
            <p class="status-line">${getStatusText()}</p>
            <div class="difficulty-tabs" aria-label="Difficulty">
              ${DIFFICULTIES.map((difficulty) => `
                <button
                  class="${difficulty.id === selectedDifficulty ? 'is-active' : ''}"
                  data-difficulty="${difficulty.id}"
                  type="button"
                >
                  ${difficulty.label} ${difficulty.discCount}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="tower-board" role="group" aria-label="Peg board">
            ${PEG_INDICES.map((pegIndex) => renderPeg(pegIndex, legalDestinations)).join('')}
          </div>

          <div class="message-bar">
            <span>${getInstructionText(legalDestinations)}</span>
            <span>Keyboard: Arrows / Space / N / P</span>
          </div>

          <div class="won-banner" ${phase === 'won' ? '' : 'hidden'}>
            <div>
              <span>COMPLETE</span>
              <strong>${numberFormat.format(currentScore)}</strong>
              <button class="action-button action-button--primary" data-action="new" type="button">New Game</button>
            </div>
          </div>
        </section>

        <aside class="side-panel" aria-label="Controls and score">
          <div class="score-card">
            <span>Selected Peg</span>
            <strong>${state.selectedPeg === null ? '-' : state.selectedPeg + 1}</strong>
          </div>

          <div class="action-grid">
            <button class="action-button action-button--primary" data-action="new" type="button">New</button>
            <button class="action-button" data-action="pause" type="button">${phase === 'paused' ? 'Resume' : 'Pause'}</button>
          </div>

          <div class="controls-card">
            <span>Rules</span>
            <ul>
              <li>Move every disc from peg 1 to peg 3.</li>
              <li>Only one top disc can move at a time.</li>
              <li>A larger disc cannot sit on a smaller disc.</li>
              <li>Score loses points by time and extra moves.</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  `;
}

function renderPeg(pegIndex: PegIndex, legalDestinations: readonly PegIndex[]): string {
  const peg = state.pegs[pegIndex];
  const isSelected = state.selectedPeg === pegIndex;
  const isLegal = legalDestinations.includes(pegIndex);
  const classes = [
    'peg',
    focusedPeg === pegIndex ? 'is-focused' : '',
    isSelected ? 'is-selected' : '',
    isLegal ? 'is-legal' : '',
  ].filter(Boolean).join(' ');

  return `
    <button class="${classes}" data-peg="${pegIndex}" type="button" aria-label="Peg ${pegIndex + 1}">
      <div class="disc-stack">
        ${peg.map((disc) => renderDisc(disc)).join('')}
      </div>
      <span class="peg-label">PEG ${pegIndex + 1}</span>
    </button>
  `;
}

function renderDisc(disc: number): string {
  const width = 34 + disc * 11;
  const colorPair = DISC_COLORS[(disc - 1) % DISC_COLORS.length];

  return `
    <span
      class="disc"
      style="width: min(${width}%, 96%); --disc-light: ${colorPair[0]}; --disc-color: ${colorPair[1]};"
    >
      ${disc}
    </span>
  `;
}

function getStatusText(): string {
  if (phase === 'won') {
    return 'Puzzle solved. Start a new run to improve the score.';
  }

  if (phase === 'paused') {
    return 'Paused. Resume when ready.';
  }

  if (phase === 'stopped') {
    return 'Stopped by hub command.';
  }

  if (phase === 'ready') {
    return 'Move the tower to the right peg.';
  }

  return 'Move smaller discs first and finish with fewer extra moves.';
}

function getInstructionText(legalDestinations: readonly PegIndex[]): string {
  if (state.selectedPeg === null) {
    return getTopDisc(state.pegs[focusedPeg]) === undefined
      ? 'Choose a peg with a top disc.'
      : `Choose peg ${focusedPeg + 1} to lift its top disc.`;
  }

  if (legalDestinations.length === 0) {
    return 'No legal destination. Choose the same peg to cancel.';
  }

  return `Move from peg ${state.selectedPeg + 1} to peg ${legalDestinations.map((peg) => peg + 1).join(' or ')}.`;
}

function readBestScore(difficultyId: DifficultyId): number {
  const score = Number(window.localStorage.getItem(createBestScoreKey(difficultyId)));

  return Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
}

function createBestScoreKey(difficultyId: DifficultyId): string {
  return `${BEST_SCORE_KEY_PREFIX}:${difficultyId}`;
}

function notifyParent(type: 'minigame:start' | 'minigame:score' | 'minigame:game-over', score?: number): void {
  if (window.parent === window) {
    return;
  }

  window.parent.postMessage(
    {
      type,
      gameSlug: GAME_SLUG,
      score,
    },
    window.origin,
  );
}

function isHubMessage(message: HubMessage): message is { command: HubCommand; gameSlug: string; source: string } {
  return (
    message.source === 'minigame-hub'
    && message.gameSlug === GAME_SLUG
    && (message.command === 'start' || message.command === 'pause' || message.command === 'gameOver')
  );
}

function isPegIndex(value: number): value is PegIndex {
  return value === 0 || value === 1 || value === 2;
}

function wrapPeg(value: number): PegIndex {
  const normalized = (value + PEG_INDICES.length) % PEG_INDICES.length;

  if (!isPegIndex(normalized)) {
    return 0;
  }

  return normalized;
}
