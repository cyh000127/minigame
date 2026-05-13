import './styles.css';
import {
  DIFFICULTIES,
  advanceRound,
  calculateRoundScore,
  countLightsOn,
  createPuzzleState,
  getColumn,
  getRow,
  isSolved,
  isTimedOut,
  recordFailure,
  tickTimer,
  toggleAt,
  type DifficultyId,
  type PuzzleState,
} from './game';

interface MiniGameLifecycleMessage {
  readonly source: 'minigame-hub';
  readonly command: 'start' | 'pause' | 'gameOver';
  readonly gameSlug: string;
}

type GamePhase = 'playing' | 'paused' | 'failed' | 'stopped';

const BEST_SCORE_PREFIX = 'minigame:lights-out:best-score:';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;

appRoot.innerHTML = `
  <main class="shell" data-phase="playing">
    <header class="topbar">
      <div>
        <p>LIGHTS OUT</p>
        <h1>라이트 아웃</h1>
      </div>
      <button class="new-button" data-new-game type="button">New Game</button>
    </header>

    <section class="hud" aria-label="Game status">
      <div>
        <span>LEVEL</span>
        <strong data-level>Easy</strong>
      </div>
      <div>
        <span>TIME LEFT</span>
        <strong data-time>00:00</strong>
      </div>
      <div>
        <span>ROUND</span>
        <strong data-moves>0</strong>
      </div>
      <div>
        <span>LIGHTS</span>
        <strong data-lights>0</strong>
      </div>
    </section>

    <section class="difficulty-panel" aria-label="Difficulty selector">
      ${DIFFICULTIES.map(
        (difficulty) =>
          `<button data-difficulty="${difficulty.id}" type="button">${difficulty.label} ${difficulty.size}x${difficulty.size}</button>`,
      ).join('')}
    </section>

    <section class="game-area">
      <section class="board" data-board aria-label="Lights Out board"></section>
      <aside class="control-panel" aria-label="Controls">
        <div class="score-panel">
          <span>CURRENT</span>
          <strong data-score>0</strong>
        </div>
        <div class="score-panel">
          <span>BEST</span>
          <strong data-best>--</strong>
        </div>
        <div class="selected-panel">
          <span>SELECTED</span>
          <strong data-selected>R1 C1</strong>
        </div>
        <button class="toggle-button" data-toggle-selected type="button">Toggle</button>
        <p class="help-text" data-help-text>제한시간 안에 모든 불을 끄면 점수를 얻고 새 맵으로 넘어갑니다.</p>
      </aside>

      <div class="overlay" data-overlay hidden>
        <p data-overlay-kicker>PAUSED</p>
        <h2 data-overlay-title>잠시 멈춤</h2>
        <button data-overlay-action type="button">Resume</button>
      </div>
    </section>
  </main>
`;

const shell = mustQuery<HTMLElement>('.shell');
const boardElement = mustQuery<HTMLElement>('[data-board]');
const levelElement = mustQuery<HTMLElement>('[data-level]');
const timeElement = mustQuery<HTMLElement>('[data-time]');
const movesElement = mustQuery<HTMLElement>('[data-moves]');
const lightsElement = mustQuery<HTMLElement>('[data-lights]');
const scoreElement = mustQuery<HTMLElement>('[data-score]');
const bestElement = mustQuery<HTMLElement>('[data-best]');
const selectedElement = mustQuery<HTMLElement>('[data-selected]');
const helpText = mustQuery<HTMLElement>('[data-help-text]');
const overlay = mustQuery<HTMLElement>('[data-overlay]');
const overlayKicker = mustQuery<HTMLElement>('[data-overlay-kicker]');
const overlayTitle = mustQuery<HTMLElement>('[data-overlay-title]');
const overlayAction = mustQuery<HTMLButtonElement>('[data-overlay-action]');
const newGameButton = mustQuery<HTMLButtonElement>('[data-new-game]');
const toggleSelectedButton = mustQuery<HTMLButtonElement>('[data-toggle-selected]');

let difficultyId: DifficultyId = 'easy';
let state: PuzzleState = createPuzzleState(difficultyId);
let selectedIndex = 0;
let phase: GamePhase = 'playing';
let timerId = 0;
let lastRoundGain = 0;
let statusText = '제한시간 안에 모든 불을 끄세요.';

newGameButton.addEventListener('click', () => startNewGame(difficultyId));
toggleSelectedButton.addEventListener('click', () => toggleCell(selectedIndex));
overlayAction.addEventListener('click', () => {
  if (phase === 'failed' || phase === 'stopped') {
    startNewGame(difficultyId);
    return;
  }

  resumeGame();
});

for (const button of appRoot.querySelectorAll<HTMLButtonElement>('[data-difficulty]')) {
  button.addEventListener('click', () => {
    startNewGame(button.dataset.difficulty as DifficultyId);
  });
}

boardElement.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-index]') : null;

  if (!button) {
    return;
  }

  selectedIndex = Number(button.dataset.index);
  toggleCell(selectedIndex);
});

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'n') {
    event.preventDefault();
    startNewGame(difficultyId);
    return;
  }

  if (phase !== 'playing') {
    return;
  }

  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    toggleCell(selectedIndex);
    return;
  }

  const direction = getDirectionFromKey(event.key);

  if (direction) {
    event.preventDefault();
    moveSelection(direction);
  }
});

window.addEventListener('message', (event: MessageEvent<MiniGameLifecycleMessage>) => {
  if (event.data?.source !== 'minigame-hub' || event.data.gameSlug !== 'lights-out') {
    return;
  }

  if (event.data.command === 'start') {
    resumeGame();
  }

  if (event.data.command === 'pause') {
    pauseGame();
  }

  if (event.data.command === 'gameOver') {
    stopGame();
  }
});

startTimer();
render();

function startNewGame(nextDifficultyId: DifficultyId): void {
  difficultyId = nextDifficultyId;
  state = createPuzzleState(difficultyId);
  selectedIndex = 0;
  phase = 'playing';
  lastRoundGain = 0;
  statusText = '제한시간 안에 모든 불을 끄세요.';
  startTimer();
  notifyScore(0);
  render();
}

function toggleCell(index: number): void {
  if (phase !== 'playing') {
    return;
  }

  state = {
    ...state,
    board: toggleAt(state.board, state.difficulty.size, index),
    moves: state.moves + 1,
  };

  if (isSolved(state.board)) {
    completeRound();
    return;
  }

  render();
}

function completeRound(): void {
  const previousScore = state.score;
  const completedRound = state.round;
  state = advanceRound(state);
  selectedIndex = 0;
  lastRoundGain = state.score - previousScore;
  statusText = `${completedRound}라운드 클리어. +${lastRoundGain.toLocaleString('ko-KR')}점`;
  notifyScore(state.score);
  render();
}

function pauseGame(): void {
  if (phase !== 'playing') {
    return;
  }

  phase = 'paused';
  stopTimer();
  render();
}

function resumeGame(): void {
  if (phase === 'failed' || phase === 'stopped') {
    return;
  }

  phase = 'playing';
  startTimer();
  render();
}

function stopGame(): void {
  if (phase === 'failed') {
    return;
  }

  phase = 'stopped';
  finishRun();
  render();
}

function startTimer(): void {
  if (timerId || phase !== 'playing') {
    return;
  }

  timerId = window.setInterval(() => {
    state = tickTimer(state, 1);

    if (isTimedOut(state)) {
      state = recordFailure(state);
      phase = 'failed';
      statusText = `${state.round}라운드 시간초과. 점수를 기록했습니다.`;
      finishRun();
      render();
      return;
    }

    renderHud();
  }, 1_000);
}

function stopTimer(): void {
  if (!timerId) {
    return;
  }

  window.clearInterval(timerId);
  timerId = 0;
}

function moveSelection(direction: 'up' | 'down' | 'left' | 'right'): void {
  const size = state.difficulty.size;
  const row = getRow(selectedIndex, size);
  const column = getColumn(selectedIndex, size);

  if (direction === 'up') {
    selectedIndex = Math.max(0, row - 1) * size + column;
  }

  if (direction === 'down') {
    selectedIndex = Math.min(size - 1, row + 1) * size + column;
  }

  if (direction === 'left') {
    selectedIndex = row * size + Math.max(0, column - 1);
  }

  if (direction === 'right') {
    selectedIndex = row * size + Math.min(size - 1, column + 1);
  }

  render();
}

function render(): void {
  shell.dataset.phase = phase;
  renderHud();
  renderBoard();
  renderDifficultyButtons();
  renderOverlay();
}

function renderHud(): void {
  levelElement.textContent = `${state.difficulty.label} ${state.difficulty.size}x${state.difficulty.size}`;
  timeElement.textContent = formatTime(state.remainingSeconds);
  movesElement.textContent = `${state.round} / M${state.moves}`;
  lightsElement.textContent = countLightsOn(state.board).toString();
  scoreElement.textContent = state.score.toString();
  bestElement.textContent = loadBestScore(difficultyId)?.toString() ?? '--';
  selectedElement.textContent = `R${getRow(selectedIndex, state.difficulty.size) + 1} C${getColumn(
    selectedIndex,
    state.difficulty.size,
  ) + 1}`;
  helpText.textContent = getHelpText();
}

function renderBoard(): void {
  boardElement.style.setProperty('--size', state.difficulty.size.toString());
  boardElement.innerHTML = state.board.map((isOn, index) => {
    const classes = ['light'];

    if (isOn) {
      classes.push('is-on');
    }

    if (index === selectedIndex) {
      classes.push('is-selected');
    }

    return `
      <button
        class="${classes.join(' ')}"
        data-index="${index}"
        type="button"
        aria-label="${index + 1}번 ${isOn ? '켜진' : '꺼진'} 불"
        aria-pressed="${isOn ? 'true' : 'false'}"
      ></button>
    `;
  }).join('');
}

function renderDifficultyButtons(): void {
  for (const button of appRoot.querySelectorAll<HTMLButtonElement>('[data-difficulty]')) {
    button.classList.toggle('is-selected', button.dataset.difficulty === difficultyId);
  }
}

function renderOverlay(): void {
  overlay.hidden = phase === 'playing';

  if (phase === 'paused') {
    overlayKicker.textContent = 'PAUSED';
    overlayTitle.textContent = '잠시 멈춤';
    overlayAction.textContent = 'Resume';
  }

  if (phase === 'failed') {
    overlayKicker.textContent = 'TIME OUT';
    overlayTitle.textContent = `${state.score}점 기록`;
    overlayAction.textContent = 'New Run';
  }

  if (phase === 'stopped') {
    overlayKicker.textContent = 'STOPPED';
    overlayTitle.textContent = `${state.score}점 기록`;
    overlayAction.textContent = 'New Run';
  }
}

function getDirectionFromKey(key: string): 'up' | 'down' | 'left' | 'right' | null {
  const normalizedKey = key.toLowerCase();

  if (normalizedKey === 'arrowup' || normalizedKey === 'w') {
    return 'up';
  }

  if (normalizedKey === 'arrowdown' || normalizedKey === 's') {
    return 'down';
  }

  if (normalizedKey === 'arrowleft' || normalizedKey === 'a') {
    return 'left';
  }

  if (normalizedKey === 'arrowright' || normalizedKey === 'd') {
    return 'right';
  }

  return null;
}

function getHelpText(): string {
  if (phase === 'paused') {
    return '일시정지 중입니다.';
  }

  if (phase === 'failed') {
    return '시간초과로 실패했습니다. New Run으로 다시 시작하세요.';
  }

  if (phase === 'stopped') {
    return '허브 명령으로 게임이 종료되었습니다.';
  }

  const roundBonus = calculateRoundScore({
    difficultyId,
    round: state.round,
    remainingSeconds: state.remainingSeconds,
    moves: state.moves,
  });

  return `${statusText} 현재 라운드 보너스 ${roundBonus.toLocaleString('ko-KR')}점. 최근 획득 ${lastRoundGain.toLocaleString('ko-KR')}점.`;
}

function finishRun(): void {
  stopTimer();
  saveBestScore(difficultyId, state.score);
  notifyScore(state.score);
  notifyGameOver(state.score);
}

function loadBestScore(nextDifficultyId: DifficultyId): number | null {
  const value = window.localStorage.getItem(getBestScoreKey(nextDifficultyId));
  const score = Number.parseInt(value ?? '', 10);

  return Number.isFinite(score) ? score : null;
}

function saveBestScore(nextDifficultyId: DifficultyId, score: number): void {
  const currentBest = loadBestScore(nextDifficultyId);

  if (currentBest !== null && currentBest >= score) {
    return;
  }

  window.localStorage.setItem(getBestScoreKey(nextDifficultyId), score.toString());
}

function getBestScoreKey(nextDifficultyId: DifficultyId): string {
  return `${BEST_SCORE_PREFIX}${nextDifficultyId}`;
}

function notifyScore(score: number): void {
  if (window.parent === window) {
    return;
  }

  window.parent.postMessage(
    {
      type: 'minigame:score',
      gameSlug: 'lights-out',
      score,
    },
    window.origin,
  );
}

function notifyGameOver(score: number): void {
  if (window.parent === window) {
    return;
  }

  window.parent.postMessage(
    {
      type: 'minigame:game-over',
      gameSlug: 'lights-out',
      score,
    },
    window.origin,
  );
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function mustQuery<TElement extends Element>(selector: string): TElement {
  const element = appRoot.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Missing UI element: ${selector}`);
  }

  return element;
}
