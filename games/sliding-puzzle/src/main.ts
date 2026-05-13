import './styles.css';
import {
  DIFFICULTIES,
  EMPTY,
  calculateScore,
  createPuzzleState,
  isSolved,
  moveByDirection,
  moveTile,
  type DifficultyId,
  type Direction,
} from './game';

interface MiniGameLifecycleMessage {
  readonly source: 'minigame-hub';
  readonly command: 'start' | 'pause' | 'gameOver';
  readonly gameSlug: string;
}

type GamePhase = 'playing' | 'paused' | 'won' | 'stopped';

const BEST_SCORE_PREFIX = 'minigame:sliding-puzzle:best-score:';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;

appRoot.innerHTML = `
  <main class="shell" data-phase="playing">
    <header class="topbar">
      <div>
        <p>SLIDING PUZZLE</p>
        <h1>슬라이딩 퍼즐</h1>
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
        <span>BEST</span>
        <strong data-best>--</strong>
      </div>
    </section>

    <section class="difficulty-panel" aria-label="Difficulty selector">
      ${DIFFICULTIES.map(
        (difficulty) =>
          `<button data-difficulty="${difficulty.id}" type="button">${difficulty.label} ${difficulty.size}x${difficulty.size}</button>`,
      ).join('')}
    </section>

    <section class="game-area">
      <section class="board" data-board aria-label="Sliding puzzle board"></section>
      <aside class="control-panel" aria-label="Controls">
        <div class="score-panel">
          <span>CURRENT SCORE</span>
          <strong data-score>0</strong>
        </div>
        <div class="arrow-pad" aria-label="Keyboard preview">
          <button data-direction="up" type="button">Up</button>
          <button data-direction="left" type="button">Left</button>
          <button data-direction="down" type="button">Down</button>
          <button data-direction="right" type="button">Right</button>
        </div>
        <p class="help-text">타일을 클릭하거나 방향키/WASD로 빈 칸을 움직입니다. N은 새 게임입니다.</p>
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
const bestElement = mustQuery<HTMLElement>('[data-best]');
const scoreElement = mustQuery<HTMLElement>('[data-score]');
const overlay = mustQuery<HTMLElement>('[data-overlay]');
const overlayKicker = mustQuery<HTMLElement>('[data-overlay-kicker]');
const overlayTitle = mustQuery<HTMLElement>('[data-overlay-title]');
const overlayAction = mustQuery<HTMLButtonElement>('[data-overlay-action]');
const newGameButton = mustQuery<HTMLButtonElement>('[data-new-game]');

let difficultyId: DifficultyId = 'easy';
let state = createPuzzleState(difficultyId);
let phase: GamePhase = 'playing';
let timerId = 0;

newGameButton.addEventListener('click', () => startNewGame(difficultyId));
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

  moveTileByIndex(Number(button.dataset.index));
});

for (const button of appRoot.querySelectorAll<HTMLButtonElement>('[data-direction]')) {
  button.addEventListener('click', () => {
    moveEmpty(button.dataset.direction as Direction);
  });
}

window.addEventListener('keydown', (event) => {
  const direction = getDirectionFromKey(event.key);

  if (direction) {
    event.preventDefault();
    moveEmpty(direction);
    return;
  }

  if (event.key.toLowerCase() === 'n') {
    event.preventDefault();
    startNewGame(difficultyId);
  }
});

window.addEventListener('message', (event: MessageEvent<MiniGameLifecycleMessage>) => {
  if (event.data?.source !== 'minigame-hub' || event.data.gameSlug !== 'sliding-puzzle') {
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
  phase = 'playing';
  startTimer();
  render();
}

function moveTileByIndex(index: number): void {
  if (phase !== 'playing') {
    return;
  }

  const nextBoard = moveTile(state.board, state.difficulty.size, index);
  commitMove(nextBoard);
}

function moveEmpty(direction: Direction): void {
  if (phase !== 'playing') {
    return;
  }

  const nextBoard = moveByDirection(state.board, state.difficulty.size, direction);
  commitMove(nextBoard);
}

function commitMove(nextBoard: readonly number[]): void {
  if (nextBoard === state.board) {
    return;
  }

  state = {
    ...state,
    board: nextBoard,
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
  scoreElement.textContent = getCurrentScore().toString();
  bestElement.textContent = loadBestScore(difficultyId)?.toString() ?? '--';
}

function renderBoard(): void {
  boardElement.style.setProperty('--size', state.difficulty.size.toString());
  boardElement.innerHTML = state.board.map((value, index) => {
    const classes = ['tile'];

    if (value === EMPTY) {
      classes.push('tile--empty');
    }

    return `
      <button
        class="${classes.join(' ')}"
        data-index="${index}"
        type="button"
        aria-label="${value === EMPTY ? '빈 칸' : `${value} 타일`}"
      >${value === EMPTY ? '' : value.toString()}</button>
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

function getDirectionFromKey(key: string): Direction | null {
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
      gameSlug: 'sliding-puzzle',
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
      gameSlug: 'sliding-puzzle',
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
