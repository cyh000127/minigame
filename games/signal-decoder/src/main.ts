import './styles.css';
import {
  DIFFICULTIES,
  DIRECTIONS,
  calculateStageScore,
  createInitialState,
  isFailed,
  isTimedOut,
  recordFailure,
  submitSignal,
  tickTimer,
  type DifficultyId,
  type DirectionId,
} from './game';

type Phase = 'ready' | 'playing' | 'paused' | 'failed' | 'stopped';
type HubCommand = 'start' | 'pause' | 'gameOver';

interface HubMessage {
  readonly source?: unknown;
  readonly command?: unknown;
  readonly gameSlug?: unknown;
}

const GAME_SLUG = 'signal-decoder';
const BEST_SCORE_KEY_PREFIX = 'minigame:signal-decoder:best-score';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;
let state = createInitialState('normal');
let selectedDifficulty: DifficultyId = state.difficulty.id;
let phase: Phase = 'ready';
let timerId: number | null = null;
let lastStageGain = 0;
let statusText = 'Decode the queue in order before the timer or strike limit runs out.';

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

  const signalButton = target.closest<HTMLButtonElement>('[data-signal]');
  if (signalButton?.dataset.signal) {
    handleSignal(signalButton.dataset.signal as DirectionId);
  }
});

function startGame(difficultyId: DifficultyId = selectedDifficulty): void {
  selectedDifficulty = difficultyId;
  state = createInitialState(difficultyId, Date.now());
  phase = 'playing';
  lastStageGain = 0;
  statusText = 'Decode the queue in order before the timer or strike limit runs out.';
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
  handleSignal(direction);
}

function handleSignal(directionId: DirectionId): void {
  if (phase === 'failed' || phase === 'stopped') {
    startGame();
    return;
  }

  if (phase !== 'playing') {
    return;
  }

  const result = submitSignal(state, directionId);
  state = result.state;

  if (!result.correct) {
    statusText = isTimedOut(state)
      ? 'Timer ran out after a wrong signal.'
      : `Wrong signal. Strike ${state.strikes}/3.`;
  }

  if (result.clearedStage) {
    lastStageGain = result.scoreGain;
    statusText = `Stage ${state.stage - 1} clear. +${numberFormat.format(result.scoreGain)} score.`;
    notifyParent('minigame:score', state.score);
    render();
    return;
  }

  if (result.failed || isFailed(state)) {
    state = recordFailure(state);
    phase = 'failed';
    statusText = state.strikes >= 3 ? 'Strike limit reached.' : 'Timer ran out.';
    finishRun();
    render();
    return;
  }

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
      statusText = 'Timer ran out.';
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
  const currentStageScore = calculateStageScore({
    difficultyId: state.difficulty.id,
    stage: state.stage,
    remainingSeconds: state.remainingSeconds,
    sequenceLength: state.sequence.length,
    strikes: state.strikes,
  });
  const bestScore = readBestScore(selectedDifficulty);
  const timerWidth = `${Math.max(0, Math.min(100, (state.remainingSeconds / state.stageTimeSeconds) * 100)).toFixed(1)}%`;
  const activeSignal = state.sequence[state.progressIndex] ?? null;
  const remainingQueue = state.sequence.slice(state.progressIndex + 1);

  appRoot.innerHTML = `
    <main class="game-shell" data-phase="${phase}">
      <header class="topbar">
        <div>
          <p class="eyebrow">REACTION SEQUENCE</p>
          <h1>Signal Decoder</h1>
        </div>
        <section class="hud" aria-label="Game status">
          <div class="hud__item">
            <span>Time</span>
            <strong>${formatSeconds(state.remainingSeconds)}</strong>
          </div>
          <div class="hud__item">
            <span>Stage</span>
            <strong>${state.stage}</strong>
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

      <section class="playfield" aria-label="Signal Decoder game">
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
                  ${difficulty.label}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="timer-track" aria-label="Stage time remaining">
            <div class="timer-fill" style="--timer-width: ${timerWidth};"></div>
          </div>

          <div class="stage-grid">
            <section class="focus-card" aria-label="Current signal">
              <small>Current Signal</small>
              <div class="focus-signal">${formatDirection(activeSignal)}</div>
            </section>

            <section class="queue-card" aria-label="Remaining queue">
              <small>Queue</small>
              <div class="queue-list">
                ${remainingQueue.length > 0
                  ? remainingQueue.map((direction) => `<span class="queue-chip">${formatDirection(direction)}</span>`).join('')
                  : '<span class="queue-chip">LAST INPUT</span>'}
              </div>
            </section>

            <div class="signal-pad" aria-label="Signal input pad">
              ${DIRECTIONS.map((direction) => `
                <button
                  class="signal-button signal-button--${direction.id}"
                  data-signal="${direction.id}"
                  type="button"
                  ${phase !== 'playing' ? 'disabled' : ''}
                >
                  ${direction.label}
                </button>
              `).join('')}
              <div class="signal-center">DECODE</div>
            </div>
          </div>

          <div class="message-bar">
            <span>${getInstructionText(currentStageScore)}</span>
            <span>Arrow Keys / N / P</span>
          </div>

          <div class="overlay" ${phase === 'failed' || phase === 'stopped' ? '' : 'hidden'}>
            <div>
              <span>${phase === 'failed' ? 'RUN FAILED' : 'STOPPED'}</span>
              <strong>${numberFormat.format(state.score)}</strong>
              <button class="action-button action-button--primary" data-action="new" type="button">New Run</button>
            </div>
          </div>
        </section>

        <aside class="side-panel" aria-label="Score and controls">
          <div class="score-card">
            <span>Stage Bonus</span>
            <strong>${numberFormat.format(currentStageScore)}</strong>
          </div>

          <div class="score-card score-card--compact">
            <span>Progress / Strikes / Fail</span>
            <strong>${state.progressIndex}/${state.sequence.length} / ${state.strikes} / ${state.failures}</strong>
          </div>

          <div class="action-grid">
            <button class="action-button action-button--primary" data-action="new" type="button">New</button>
            <button class="action-button" data-action="pause" type="button">${phase === 'paused' ? 'Resume' : 'Pause'}</button>
          </div>

          <div class="controls-card">
            <span>Rules</span>
            <ul>
              <li>Press the exact arrow signal shown at the head of the queue.</li>
              <li>Finish the full sequence to clear the stage.</li>
              <li>Three strikes or timer expiration ends the run.</li>
              <li>Clearing a stage extends the sequence and adds score.</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  `;
}

function getStatusText(): string {
  if (phase === 'paused') {
    return 'Paused. Resume before the sequence slips.';
  }

  if (phase === 'failed') {
    return 'Run failed. Final score recorded.';
  }

  if (phase === 'stopped') {
    return 'Stopped by hub command.';
  }

  if (phase === 'ready') {
    return 'Decode the queue in order.';
  }

  return statusText;
}

function getInstructionText(currentStageScore: number): string {
  if (phase === 'failed' || phase === 'stopped') {
    return 'Press New to start a fresh run.';
  }

  return `Current bonus ${numberFormat.format(currentStageScore)}. Last gain ${numberFormat.format(lastStageGain)}.`;
}

function getDirectionFromKey(key: string): DirectionId | null {
  return DIRECTIONS.find((direction) => direction.key === key)?.id ?? null;
}

function formatDirection(direction: DirectionId | null): string {
  if (!direction) {
    return 'DONE';
  }

  return DIRECTIONS.find((entry) => entry.id === direction)?.label ?? 'UP';
}

function formatSeconds(seconds: number): string {
  return seconds.toFixed(1).replace(/\.0$/, '');
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
