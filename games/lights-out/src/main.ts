import './styles.css';
import {
  DIFFICULTIES,
  calculateScore,
  countLightsOn,
  createPuzzleState,
  getColumn,
  getRow,
  isSolved,
  toggleAt,
  type DifficultyId,
  type PuzzleState,
} from './game';

interface MiniGameLifecycleMessage {
  readonly source: 'minigame-hub';
  readonly command: 'start' | 'pause' | 'gameOver';
  readonly gameSlug: string;
}

type GamePhase = 'playing' | 'paused' | 'won' | 'stopped';

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
        <span>TIME</span>
        <strong data-time>00:00</strong>
      </div>
      <div>
        <span>MOVES</span>
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
        <p class="help-text">불이 켜진 칸을 모두 끄세요. 클릭으로 토글하고, 방향키/WASD로 선택 이동, Space/Enter로 토글합니다.</p>
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

newGameButton.addEventListener('click', () => startNewGame(difficultyId));
toggleSelectedButton.addEventListener('click', () => toggleCell(selectedIndex));
overlayAction.addEventListener('click', () => {
  if (phase === 'won' || phase === 'stopped') {
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
  startTimer();
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
    completeGame();
    return;
  }

  notifyScore(getCurrentScore());
  render();
}

function completeGame(): void {
  phase = 'won';
  stopTimer();
  const score = getCurrentScore();
  saveBestScore(difficultyId, score);
  notifyGameOver(score);
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
  if (phase === 'won' || phase === 'stopped') {
    return;
  }

  phase = 'playing';
  startTimer();
  render();
}

function stopGame(): void {
  if (phase === 'won') {
    return;
  }

  phase = 'stopped';
  stopTimer();
  render();
}

function startTimer(): void {
  if (timerId || phase !== 'playing') {
    return;
  }

  timerId = window.setInterval(() => {
    state = {
      ...state,
      elapsedSeconds: state.elapsedSeconds + 1,
    };
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
  timeElement.textContent = formatTime(state.elapsedSeconds);
  movesElement.textContent = state.moves.toString();
  lightsElement.textContent = countLightsOn(state.board).toString();
  scoreElement.textContent = getCurrentScore().toString();
  bestElement.textContent = loadBestScore(difficultyId)?.toString() ?? '--';
  selectedElement.textContent = `R${getRow(selectedIndex, state.difficulty.size) + 1} C${getColumn(
    selectedIndex,
    state.difficulty.size,
  ) + 1}`;
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

  if (phase === 'won') {
    overlayKicker.textContent = 'CLEAR';
    overlayTitle.textContent = `${state.moves} moves / ${getCurrentScore()}점`;
    overlayAction.textContent = 'New Game';
  }

  if (phase === 'stopped') {
    overlayKicker.textContent = 'STOPPED';
    overlayTitle.textContent = '게임 종료';
    overlayAction.textContent = 'New Game';
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

function getCurrentScore(): number {
  return calculateScore({
    difficultyId,
    elapsedSeconds: state.elapsedSeconds,
    moves: state.moves,
  });
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
