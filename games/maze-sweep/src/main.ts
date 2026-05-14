import './styles.css';
import {
  DIFFICULTIES,
  advanceRound,
  calculateRoundScore,
  canExit,
  countRemainingCollectibles,
  createInitialState,
  createPositionKey,
  isTimedOut,
  movePlayer,
  recordFailure,
  tickTimer,
  type DifficultyId,
  type DirectionId,
  type MazeCell,
} from './game';

type Phase = 'ready' | 'playing' | 'paused' | 'failed' | 'stopped';
type HubCommand = 'start' | 'pause' | 'gameOver';

interface HubMessage {
  readonly source?: unknown;
  readonly command?: unknown;
  readonly gameSlug?: unknown;
}

const GAME_SLUG = 'maze-sweep';
const BEST_SCORE_KEY_PREFIX = 'minigame:maze-sweep:best-score';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;
let state = createInitialState('normal');
let selectedDifficulty: DifficultyId = state.difficulty.id;
let phase: Phase = 'ready';
let timerId: number | null = null;
let lastRoundGain = 0;
let statusText = 'Collect every orb and then step onto the green exit.';

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
  }
});

function startGame(difficultyId: DifficultyId = selectedDifficulty): void {
  selectedDifficulty = difficultyId;
  state = createInitialState(difficultyId, Date.now());
  phase = 'playing';
  lastRoundGain = 0;
  statusText = 'Collect every orb and then step onto the green exit.';
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

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'n' || event.key === 'N') {
    event.preventDefault();
    startGame();
    return;
  }

  if (event.key === 'p' || event.key === 'P') {
    event.preventDefault();
    handleAction('pause');
    return;
  }

  const direction = getDirectionFromKey(event.key);

  if (!direction) {
    return;
  }

  event.preventDefault();

  if (phase === 'failed' || phase === 'stopped') {
    startGame();
    return;
  }

  if (phase !== 'playing') {
    return;
  }

  const previousState = state;
  state = movePlayer(state, direction);

  if (state === previousState) {
    return;
  }

  if (canExit(state)) {
    completeRound();
    return;
  }

  render();
}

function completeRound(): void {
  const previousScore = state.score;
  const completedRound = state.round;

  state = advanceRound(state, Date.now() + completedRound * 7919);
  lastRoundGain = state.score - previousScore;
  statusText = `Round ${completedRound} clear. +${numberFormat.format(lastRoundGain)} score.`;
  notifyParent('minigame:score', state.score);
  render();
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
      statusText = `Round ${state.round} timed out. Final score recorded.`;
      finishRun();
      render();
      return;
    }

    render();
  }, 1000);
}

function finishRun(): void {
  setTimerRunning(false);

  const bestScore = Math.max(state.score, readBestScore(selectedDifficulty));
  window.localStorage.setItem(createBestScoreKey(selectedDifficulty), String(bestScore));
  notifyParent('minigame:score', state.score);
  notifyParent('minigame:game-over', state.score);
}

function render(): void {
  const currentRoundScore = calculateRoundScore({
    difficultyId: state.difficulty.id,
    round: state.round,
    remainingSeconds: state.remainingSeconds,
    collectedCount: state.collectibles.length,
    steps: state.steps,
  });
  const bestScore = readBestScore(selectedDifficulty);
  const timerWidth = `${Math.max(0, Math.min(100, (state.remainingSeconds / state.roundTimeSeconds) * 100)).toFixed(1)}%`;

  appRoot.innerHTML = `
    <main class="game-shell" data-phase="${phase}">
      <header class="topbar">
        <div>
          <p class="eyebrow">GRID ESCAPE</p>
          <h1>Maze Sweep</h1>
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
            <strong>${numberFormat.format(state.score)}</strong>
          </div>
          <div class="hud__item">
            <span>Best</span>
            <strong>${numberFormat.format(bestScore)}</strong>
          </div>
        </section>
      </header>

      <section class="playfield" aria-label="Maze Sweep game">
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

          <div class="maze-board" style="--board-size: ${state.difficulty.size};" role="group" aria-label="Maze board">
            ${state.board.flatMap((row) => row.map((cell) => renderCell(cell))).join('')}
          </div>

          <div class="message-bar">
            <span>${getInstructionText(currentRoundScore)}</span>
            <span>Arrow Keys / N / P</span>
          </div>

          <div class="overlay" ${phase === 'failed' || phase === 'stopped' ? '' : 'hidden'}>
            <div>
              <span>${phase === 'failed' ? 'TIME OUT' : 'STOPPED'}</span>
              <strong>${numberFormat.format(state.score)}</strong>
              <button class="action-button action-button--primary" data-action="new" type="button">New Run</button>
            </div>
          </div>
        </section>

        <aside class="side-panel" aria-label="Score and controls">
          <div class="score-card">
            <span>Round Bonus</span>
            <strong>${numberFormat.format(currentRoundScore)}</strong>
          </div>

          <div class="score-card score-card--compact">
            <span>Orbs / Steps / Fail</span>
            <strong>${countRemainingCollectibles(state)} / ${state.steps} / ${state.failures}</strong>
          </div>

          <div class="action-grid">
            <button class="action-button action-button--primary" data-action="new" type="button">New</button>
            <button class="action-button" data-action="pause" type="button">${phase === 'paused' ? 'Resume' : 'Pause'}</button>
          </div>

          <div class="controls-card">
            <span>Rules</span>
            <ul>
              <li>Collect every yellow orb before using the exit.</li>
              <li>Only floor cells can be crossed.</li>
              <li>Clear the stage before the timer reaches zero.</li>
              <li>Each clear loads a new solvable maze and adds score.</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  `;
}

function renderCell(cell: MazeCell): string {
  const classes = [
    'maze-cell',
    cell.kind === 'wall' ? 'maze-cell--wall' : 'maze-cell--floor',
    state.player.row === cell.row && state.player.col === cell.col ? 'is-player' : '',
    state.exit.row === cell.row && state.exit.col === cell.col ? 'is-exit' : '',
  ].filter(Boolean).join(' ');
  const cellKey = createPositionKey(cell);
  const hasCollectible = state.collectibles.some((position) => position.row === cell.row && position.col === cell.col)
    && !state.collectedKeys.includes(cellKey);
  const marker = state.player.row === cell.row && state.player.col === cell.col
    ? '<span class="marker marker--player">P</span>'
    : state.exit.row === cell.row && state.exit.col === cell.col
      ? '<span class="marker marker--exit">E</span>'
      : hasCollectible
        ? '<span class="marker marker--collectible">O</span>'
        : '';

  return `
    <div class="${classes}" aria-label="${createCellLabel(cell, hasCollectible)}">
      ${marker}
    </div>
  `;
}

function getStatusText(): string {
  if (phase === 'paused') {
    return 'Paused. Resume to keep the run alive.';
  }

  if (phase === 'failed') {
    return 'Time out. Final score has been recorded.';
  }

  if (phase === 'stopped') {
    return 'Stopped by hub command.';
  }

  if (phase === 'ready') {
    return 'Move through the maze, collect orbs, then escape.';
  }

  return statusText;
}

function getInstructionText(currentRoundScore: number): string {
  if (phase === 'failed' || phase === 'stopped') {
    return 'Press New to start a fresh run.';
  }

  return `Remaining orbs ${countRemainingCollectibles(state)}. Current round bonus ${numberFormat.format(currentRoundScore)}. Last gain ${numberFormat.format(lastRoundGain)}.`;
}

function createCellLabel(cell: MazeCell, hasCollectible: boolean): string {
  if (cell.kind === 'wall') {
    return `Wall at row ${cell.row + 1} column ${cell.col + 1}`;
  }

  if (state.player.row === cell.row && state.player.col === cell.col) {
    return `Player at row ${cell.row + 1} column ${cell.col + 1}`;
  }

  if (state.exit.row === cell.row && state.exit.col === cell.col) {
    return `Exit at row ${cell.row + 1} column ${cell.col + 1}`;
  }

  if (hasCollectible) {
    return `Orb at row ${cell.row + 1} column ${cell.col + 1}`;
  }

  return `Floor at row ${cell.row + 1} column ${cell.col + 1}`;
}

function getDirectionFromKey(key: string): DirectionId | null {
  if (key === 'ArrowUp') {
    return 'up';
  }

  if (key === 'ArrowRight') {
    return 'right';
  }

  if (key === 'ArrowDown') {
    return 'down';
  }

  if (key === 'ArrowLeft') {
    return 'left';
  }

  return null;
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

function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  return `${minutes}:${restSeconds.toString().padStart(2, '0')}`;
}
