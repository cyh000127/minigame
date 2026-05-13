import './styles.css';
import {
  DIFFICULTIES,
  DIRECTIONS,
  createInitialState,
  formatTime,
  isGameOver,
  submitAnswer,
  tickTimer,
  type DifficultyId,
} from './game';

type Phase = 'ready' | 'playing' | 'paused' | 'gameOver' | 'stopped';
type HubCommand = 'start' | 'pause' | 'gameOver';

interface HubMessage {
  readonly source?: unknown;
  readonly command?: unknown;
  readonly gameSlug?: unknown;
}

const GAME_SLUG = 'math-rush';
const BEST_SCORE_KEY_PREFIX = 'minigame:math-rush:best-score';
const TICK_MS = 100;

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;
let state = createInitialState('normal');
let selectedDifficulty: DifficultyId = state.difficulty.id;
let phase: Phase = 'ready';
let timerId: number | null = null;
let feedbackText = 'Choose the correct answer with an arrow key.';

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

  const answerButton = target.closest<HTMLButtonElement>('[data-choice]');
  const choice = Number(answerButton?.dataset.choice);

  if (answerButton && Number.isInteger(choice)) {
    handleChoice(choice);
  }
});

function startGame(difficultyId: DifficultyId = selectedDifficulty): void {
  selectedDifficulty = difficultyId;
  state = createInitialState(difficultyId, Date.now() + Math.floor(performance.now()));
  phase = 'playing';
  feedbackText = 'Solve fast. Consecutive answers build fever.';
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
  feedbackText = 'Paused.';
  render();
}

function resumeGame(): void {
  if (phase !== 'paused') {
    return;
  }

  phase = 'playing';
  feedbackText = 'Back in rush mode.';
  setTimerRunning(true);
  render();
}

function stopGame(): void {
  phase = 'stopped';
  setTimerRunning(false);
  feedbackText = 'Stopped by hub command.';
  notifyParent('minigame:game-over', state.score);
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

function handleChoice(choice: number): void {
  if (phase === 'ready' || phase === 'gameOver' || phase === 'stopped') {
    startGame();
    return;
  }

  if (phase !== 'playing') {
    return;
  }

  const result = submitAnswer(state, choice);
  state = result.state;

  if (result.correct) {
    feedbackText = `Correct. +${numberFormat.format(result.scoreGain)} points.`;
    notifyParent('minigame:score', state.score);
  } else {
    feedbackText = 'Wrong answer. Time penalty applied.';
  }

  if (result.gameOver || isGameOver(state)) {
    endGame();
    return;
  }

  render();
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

  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    if (phase !== 'playing') {
      startGame();
    }
    return;
  }

  const choiceIndex = DIRECTIONS.findIndex((direction) => direction.key === event.key);

  if (choiceIndex === -1) {
    return;
  }

  event.preventDefault();
  handleChoice(choiceIndex);
}

function endGame(): void {
  phase = 'gameOver';
  setTimerRunning(false);
  feedbackText = 'Time is up. Start a new run.';

  const bestScore = Math.max(state.score, readBestScore(selectedDifficulty));
  window.localStorage.setItem(createBestScoreKey(selectedDifficulty), String(bestScore));
  notifyParent('minigame:game-over', state.score);
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

    state = tickTimer(state, TICK_MS);

    if (isGameOver(state)) {
      endGame();
      return;
    }

    render();
  }, TICK_MS);
}

function render(): void {
  const bestScore = readBestScore(selectedDifficulty);
  const timerWidth = `${Math.max(0, Math.min(100, (state.remainingMs / state.maxTimeMs) * 100)).toFixed(1)}%`;

  appRoot.innerHTML = `
    <main class="game-shell" data-phase="${phase}">
      <header class="topbar">
        <div>
          <p class="eyebrow">ARITHMETIC REFLEX</p>
          <h1>Math Rush</h1>
        </div>
        <section class="hud" aria-label="Game status">
          <div class="hud__item">
            <span>Time</span>
            <strong>${formatTime(state.remainingMs)}</strong>
          </div>
          <div class="hud__item">
            <span>Round</span>
            <strong>${state.round}</strong>
          </div>
          <div class="hud__item">
            <span>Streak</span>
            <strong>${state.streak}</strong>
          </div>
          <div class="hud__item">
            <span>Best</span>
            <strong>${numberFormat.format(bestScore)}</strong>
          </div>
        </section>
      </header>

      <section class="playfield" aria-label="Math Rush game">
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

          <div class="math-stage">
            <div class="timer-track" aria-label="Remaining time">
              <div class="timer-fill" style="--timer-width: ${timerWidth};"></div>
            </div>
            <div class="question-card">
              <div>
                <small>${state.fever ? 'FEVER x2' : 'QUESTION'}</small>
                <strong>${state.challenge.question}</strong>
              </div>
            </div>
            <div class="answer-pad" aria-label="Answer choices">
              ${state.challenge.options.map((option, index) => renderAnswerButton(option, index)).join('')}
              <div class="pad-center">${phase === 'playing' ? 'ANSWER' : 'START'}</div>
            </div>
          </div>

          <div class="message-bar">
            <span>${feedbackText}</span>
            <span>Arrow Keys / N / P</span>
          </div>
        </section>

        <aside class="side-panel" aria-label="Score and controls">
          <div class="score-card">
            <span>Score</span>
            <strong>${numberFormat.format(state.score)}</strong>
          </div>

          <div class="fever-card">
            <strong>${state.fever ? 'FEVER ACTIVE' : 'FEVER READY'}</strong>
            <span>5 correct answers trigger x2 scoring.</span>
          </div>

          <div class="action-grid">
            <button class="action-button action-button--primary" data-action="new" type="button">New</button>
            <button class="action-button" data-action="pause" type="button">${phase === 'paused' ? 'Resume' : 'Pause'}</button>
          </div>

          <div class="controls-card">
            <span>Rules</span>
            <ul>
              <li>Pick the answer mapped to the arrow direction.</li>
              <li>Correct answers reset the timer for the next round.</li>
              <li>Wrong answers remove time and break the streak.</li>
              <li>Rounds get faster as the score run continues.</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  `;
}

function renderAnswerButton(option: number, index: number): string {
  const direction = DIRECTIONS[index];
  const disabled = phase !== 'playing';

  return `
    <button
      class="answer-button answer-button--${direction?.id ?? 'up'}"
      data-choice="${index}"
      type="button"
      ${disabled ? 'disabled' : ''}
      aria-label="${direction?.label ?? 'UP'} answer ${option}"
    >
      <span>${direction?.label ?? 'UP'}</span>
      <strong>${option}</strong>
    </button>
  `;
}

function getStatusText(): string {
  if (phase === 'ready') {
    return 'Press New or Space to start.';
  }

  if (phase === 'paused') {
    return 'Paused. Resume when ready.';
  }

  if (phase === 'gameOver') {
    return 'Game over. Try a faster run.';
  }

  if (phase === 'stopped') {
    return 'Stopped by hub command.';
  }

  return 'Choose the correct answer before the timer empties.';
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
