import './styles.css';
import {
  DIFFICULTIES,
  EAST,
  EMPTY_MASK,
  NORTH,
  SOUTH,
  WEST,
  advanceRound,
  calculateRoundScore,
  countActiveCells,
  createCellKey,
  createInitialState,
  formatTime,
  getPoweredKeys,
  isSolved,
  isTimedOut,
  recordFailure,
  rotateCell,
  tickTimer,
  type CircuitCell,
  type DifficultyId,
} from './game';

type Phase = 'ready' | 'playing' | 'paused' | 'failed' | 'stopped';
type HubCommand = 'start' | 'pause' | 'gameOver';

interface HubMessage {
  readonly source?: unknown;
  readonly command?: unknown;
  readonly gameSlug?: unknown;
}

const GAME_SLUG = 'circuit-connect';
const BEST_SCORE_KEY_PREFIX = 'minigame:circuit-connect:best-score';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;
let state = createInitialState('normal');
let selectedDifficulty: DifficultyId = state.difficulty.id;
let phase: Phase = 'ready';
let focusedRow = 0;
let focusedCol = 0;
let timerId: number | null = null;
let lastRoundGain = 0;
let statusMessage = 'Rotate the pipes before time runs out.';

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

  const tileButton = target.closest<HTMLButtonElement>('[data-row][data-col]');
  const row = Number(tileButton?.dataset.row);
  const col = Number(tileButton?.dataset.col);

  if (tileButton && Number.isInteger(row) && Number.isInteger(col)) {
    handleTileRotation(row, col);
  }
});

function startGame(difficultyId: DifficultyId = selectedDifficulty): void {
  selectedDifficulty = difficultyId;
  state = createInitialState(difficultyId);
  focusedRow = 0;
  focusedCol = 0;
  phase = 'playing';
  lastRoundGain = 0;
  statusMessage = 'Round 1 started. Connect every active pipe before timeout.';
  setTimerRunning(true);
  notifyParent('minigame:start');
  notifyParent('minigame:score', 0);
  render();
}

function beginPlaying(): void {
  if (phase !== 'ready') {
    return;
  }

  phase = 'playing';
  setTimerRunning(true);
  notifyParent('minigame:start');
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
  finishRun();
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

function handleTileRotation(row: number, col: number): void {
  if (phase === 'failed' || phase === 'stopped') {
    startGame();
    return;
  }

  beginPlaying();

  if (phase !== 'playing') {
    return;
  }

  focusedRow = row;
  focusedCol = col;

  const previousMoves = state.moves;
  state = rotateCell(state, row, col);

  if (state.moves !== previousMoves) {
    notifyParent('minigame:score', calculateCurrentScore());
  }

  if (isSolved(state)) {
    completeRound();
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
    focusedCol = wrapIndex(focusedCol - 1);
    render();
    return;
  }

  if (event.key === 'ArrowRight') {
    focusedCol = wrapIndex(focusedCol + 1);
    render();
    return;
  }

  if (event.key === 'ArrowUp') {
    focusedRow = wrapIndex(focusedRow - 1);
    render();
    return;
  }

  if (event.key === 'ArrowDown') {
    focusedRow = wrapIndex(focusedRow + 1);
    render();
    return;
  }

  handleTileRotation(focusedRow, focusedCol);
}

function completeRound(): void {
  const completedRound = state.round;
  const scoreBeforeRound = state.score;
  state = advanceRound(state, Date.now() + completedRound * 1009);
  lastRoundGain = state.score - scoreBeforeRound;
  focusedRow = 0;
  focusedCol = 0;
  statusMessage = `Round ${completedRound} clear. +${numberFormat.format(lastRoundGain)} points.`;
  notifyParent('minigame:score', state.score);
  render();
}

function calculateCurrentScore(): number {
  return state.score;
}

function calculateCurrentRoundScore(): number {
  return calculateRoundScore({
    difficultyId: state.difficulty.id,
    round: state.round,
    moves: state.moves,
    remainingSeconds: state.remainingSeconds,
    activeCells: countActiveCells(state.board),
  });
}

function finishRun(): void {
  setTimerRunning(false);

  const bestScore = Math.max(state.score, readBestScore(selectedDifficulty));
  window.localStorage.setItem(createBestScoreKey(selectedDifficulty), String(bestScore));
  notifyParent('minigame:score', state.score);
  notifyParent('minigame:game-over', state.score);
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

    if (isTimedOut(state)) {
      state = recordFailure(state);
      phase = 'failed';
      statusMessage = `Time out on round ${state.round}. Final score recorded.`;
      finishRun();
      render();
      return;
    }

    render();
  }, 1000);
}

function render(): void {
  const poweredKeys = getPoweredKeys(state.board);
  const activeCount = countActiveCells(state.board);
  const currentScore = calculateCurrentScore();
  const roundScore = calculateCurrentRoundScore();
  const bestScore = readBestScore(selectedDifficulty);
  const timerWidth = `${Math.max(0, Math.min(100, (state.remainingSeconds / state.roundTimeSeconds) * 100)).toFixed(1)}%`;

  appRoot.innerHTML = `
    <main class="game-shell" data-phase="${phase}">
      <header class="topbar">
        <div>
          <p class="eyebrow">ROTATION PUZZLE</p>
          <h1>Circuit Connect</h1>
        </div>
        <section class="hud" aria-label="Game status">
          <div class="hud__item">
            <span>Time</span>
            <strong>${formatTime(state.remainingSeconds)}</strong>
          </div>
          <div class="hud__item">
            <span>Round</span>
            <strong>${state.round}</strong>
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

      <section class="playfield" aria-label="Circuit Connect game">
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
                  ${difficulty.label} ${difficulty.size}x${difficulty.size}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="timer-track" aria-label="Round time remaining">
            <div class="timer-fill" style="--timer-width: ${timerWidth};"></div>
          </div>

          <div class="circuit-board" style="--board-size: ${state.difficulty.size};" role="group" aria-label="Circuit board">
            ${state.board.flatMap((row) => row.map((cell) => renderTile(cell, poweredKeys))).join('')}
          </div>

          <div class="message-bar">
            <span>${getInstructionText()}</span>
            <span>Keyboard: Arrows / Space / N / P</span>
          </div>

          <div class="won-banner" ${phase === 'failed' || phase === 'stopped' ? '' : 'hidden'}>
            <div>
              <span>${phase === 'failed' ? 'RUN FAILED' : 'RUN STOPPED'}</span>
              <strong>${numberFormat.format(currentScore)}</strong>
              <button class="action-button action-button--primary" data-action="new" type="button">New Run</button>
            </div>
          </div>
        </section>

        <aside class="side-panel" aria-label="Controls and score">
          <div class="score-card">
            <span>Round Bonus</span>
            <strong>${numberFormat.format(roundScore)}</strong>
          </div>

          <div class="score-card score-card--compact">
            <span>Powered / Moves / Fail</span>
            <strong>${poweredKeys.size}/${activeCount} / ${state.moves} / ${state.failures}</strong>
          </div>

          <div class="action-grid">
            <button class="action-button action-button--primary" data-action="new" type="button">New</button>
            <button class="action-button" data-action="pause" type="button">${phase === 'paused' ? 'Resume' : 'Pause'}</button>
          </div>

          <div class="controls-card">
            <span>Rules</span>
            <ul>
              <li>Rotate active tiles until every wire is powered.</li>
              <li>Power starts at the top-left source.</li>
              <li>The bottom-right battery must be connected.</li>
              <li>Clear a grid before timeout to earn score and load the next grid.</li>
              <li>Timeout records the final score and ends the run.</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  `;
}

function renderTile(cell: CircuitCell, poweredKeys: ReadonlySet<string>): string {
  const isActive = cell.solutionMask !== EMPTY_MASK;
  const isPowered = poweredKeys.has(createCellKey(cell.row, cell.col));
  const classes = [
    'tile',
    isPowered ? 'is-powered' : '',
    cell.isSource ? 'is-source' : '',
    cell.isGoal ? 'is-goal' : '',
    focusedRow === cell.row && focusedCol === cell.col ? 'is-focused' : '',
  ].filter(Boolean).join(' ');

  return `
    <button
      class="${classes}"
      data-row="${cell.row}"
      data-col="${cell.col}"
      type="button"
      ${isActive ? '' : 'disabled'}
      aria-label="${createTileLabel(cell)}"
    >
      ${renderWires(cell.mask)}
      ${isActive ? `<span class="node">${cell.isSource ? 'P' : cell.isGoal ? 'B' : ''}</span>` : ''}
    </button>
  `;
}

function renderWires(mask: number): string {
  return [
    (mask & NORTH) === NORTH ? '<span class="wire wire--north"></span>' : '',
    (mask & EAST) === EAST ? '<span class="wire wire--east"></span>' : '',
    (mask & SOUTH) === SOUTH ? '<span class="wire wire--south"></span>' : '',
    (mask & WEST) === WEST ? '<span class="wire wire--west"></span>' : '',
  ].join('');
}

function createTileLabel(cell: CircuitCell): string {
  if (cell.isSource) {
    return `Source tile row ${cell.row + 1} column ${cell.col + 1}`;
  }

  if (cell.isGoal) {
    return `Battery tile row ${cell.row + 1} column ${cell.col + 1}`;
  }

  return `Circuit tile row ${cell.row + 1} column ${cell.col + 1}`;
}

function getStatusText(): string {
  if (phase === 'paused') {
    return 'Paused. Resume when ready.';
  }

  if (phase === 'failed') {
    return 'Time out. Final score has been recorded.';
  }

  if (phase === 'stopped') {
    return 'Stopped by hub command.';
  }

  if (phase === 'ready') {
    return 'Rotate the pipes to connect power before the timer ends.';
  }

  return statusMessage;
}

function getInstructionText(): string {
  const focusedCell = state.board[focusedRow]?.[focusedCol];

  if (!focusedCell || focusedCell.solutionMask === EMPTY_MASK) {
    return 'Move focus to an active tile.';
  }

  if (phase === 'failed' || phase === 'stopped') {
    return 'Press New to start a fresh timed run.';
  }

  return `Focused tile ${focusedRow + 1}, ${focusedCol + 1}. Rotate it before the timer reaches zero.`;
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

function wrapIndex(value: number): number {
  const size = state.difficulty.size;

  return (value + size) % size;
}
