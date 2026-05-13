import './styles.css';
import {
  BOARD_SIZE,
  DIFFICULTIES,
  EMPTY,
  calculateScore,
  generatePuzzle,
  getConflictingIndexes,
  getPeerIndexes,
  isSolvedBoard,
  type DifficultyId,
  type SudokuPuzzle,
} from './game';

interface MiniGameLifecycleMessage {
  readonly source: 'minigame-hub';
  readonly command: 'start' | 'pause' | 'gameOver';
  readonly gameSlug: string;
}

type GamePhase = 'playing' | 'paused' | 'won' | 'stopped';

const BEST_SCORE_PREFIX = 'minigame:sudoku:best-score:';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;

appRoot.innerHTML = `
  <main class="shell" data-phase="playing">
    <header class="topbar">
      <div>
        <p>SUDOKU</p>
        <h1>스도쿠</h1>
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
        <span>MISTAKES</span>
        <strong data-mistakes>0</strong>
      </div>
      <div>
        <span>BEST</span>
        <strong data-best>--</strong>
      </div>
    </section>

    <section class="difficulty-panel" aria-label="Difficulty selector">
      ${DIFFICULTIES.map(
        (difficulty) =>
          `<button data-difficulty="${difficulty.id}" type="button">${difficulty.label}</button>`,
      ).join('')}
    </section>

    <section class="game-area">
      <section class="board" data-board aria-label="Sudoku board" role="grid"></section>

      <aside class="control-panel" aria-label="Sudoku controls">
        <div class="selected-panel">
          <span>SELECTED</span>
          <strong data-selected-label>--</strong>
        </div>
        <div class="number-pad" data-number-pad>
          ${Array.from({ length: 9 }, (_, index) => `<button data-number="${index + 1}" type="button">${index + 1}</button>`).join('')}
          <button data-action="erase" type="button">Erase</button>
          <button data-action="hint" type="button">Hint</button>
        </div>
        <p class="help-text">클릭으로 칸을 고르고 숫자키 1-9로 입력합니다. 방향키 이동, Backspace 삭제, H 힌트.</p>
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
const mistakesElement = mustQuery<HTMLElement>('[data-mistakes]');
const bestElement = mustQuery<HTMLElement>('[data-best]');
const selectedLabel = mustQuery<HTMLElement>('[data-selected-label]');
const newGameButton = mustQuery<HTMLButtonElement>('[data-new-game]');
const numberPad = mustQuery<HTMLElement>('[data-number-pad]');
const overlay = mustQuery<HTMLElement>('[data-overlay]');
const overlayKicker = mustQuery<HTMLElement>('[data-overlay-kicker]');
const overlayTitle = mustQuery<HTMLElement>('[data-overlay-title]');
const overlayAction = mustQuery<HTMLButtonElement>('[data-overlay-action]');

let difficultyId: DifficultyId = 'easy';
let puzzle = generatePuzzle(difficultyId);
let values = [...puzzle.puzzle];
let selectedIndex = findFirstEditableIndex(puzzle);
let phase: GamePhase = 'playing';
let elapsedSeconds = 0;
let mistakes = 0;
let hints = 0;
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
  const cellButton = getCellButton(event.target);

  if (!cellButton) {
    return;
  }

  selectedIndex = Number(cellButton.dataset.index);
  render();
});

numberPad.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;

  if (!button) {
    return;
  }

  const number = Number(button.dataset.number);

  if (Number.isInteger(number) && number >= 1 && number <= 9) {
    enterValue(number);
    return;
  }

  if (button.dataset.action === 'erase') {
    eraseValue();
  }

  if (button.dataset.action === 'hint') {
    useHint();
  }
});

window.addEventListener('keydown', (event) => {
  if (phase !== 'playing') {
    return;
  }

  if (/^[1-9]$/.test(event.key)) {
    event.preventDefault();
    enterValue(Number(event.key));
    return;
  }

  if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
    event.preventDefault();
    eraseValue();
    return;
  }

  if (event.key.toLowerCase() === 'h') {
    event.preventDefault();
    useHint();
    return;
  }

  if (event.key.toLowerCase() === 'n') {
    event.preventDefault();
    startNewGame(difficultyId);
    return;
  }

  if (event.key.startsWith('Arrow')) {
    event.preventDefault();
    moveSelection(event.key);
  }
});

window.addEventListener('message', (event: MessageEvent<MiniGameLifecycleMessage>) => {
  if (event.data?.source !== 'minigame-hub' || event.data.gameSlug !== 'sudoku') {
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
  puzzle = generatePuzzle(difficultyId);
  values = [...puzzle.puzzle];
  selectedIndex = findFirstEditableIndex(puzzle);
  phase = 'playing';
  elapsedSeconds = 0;
  mistakes = 0;
  hints = 0;
  startTimer();
  render();
}

function enterValue(value: number): void {
  if (selectedIndex === null || phase !== 'playing' || puzzle.givenIndexes.has(selectedIndex)) {
    return;
  }

  const previousValue = values[selectedIndex] ?? EMPTY;

  if (previousValue === value) {
    return;
  }

  values[selectedIndex] = value;

  if (value !== puzzle.solution[selectedIndex]) {
    mistakes += 1;
  }

  if (isSolvedBoard(values, puzzle.solution)) {
    completeGame();
    return;
  }

  notifyScore(calculateScore({ difficultyId, elapsedSeconds, mistakes, hints }));
  render();
}

function eraseValue(): void {
  if (selectedIndex === null || phase !== 'playing' || puzzle.givenIndexes.has(selectedIndex)) {
    return;
  }

  values[selectedIndex] = EMPTY;
  render();
}

function useHint(): void {
  if (phase !== 'playing') {
    return;
  }

  const hintIndex = getHintIndex();

  if (hintIndex === null) {
    return;
  }

  values[hintIndex] = puzzle.solution[hintIndex] ?? EMPTY;
  selectedIndex = hintIndex;
  hints += 1;

  if (isSolvedBoard(values, puzzle.solution)) {
    completeGame();
    return;
  }

  render();
}

function getHintIndex(): number | null {
  if (
    selectedIndex !== null &&
    !puzzle.givenIndexes.has(selectedIndex) &&
    values[selectedIndex] !== puzzle.solution[selectedIndex]
  ) {
    return selectedIndex;
  }

  return values.findIndex((value, index) => !puzzle.givenIndexes.has(index) && value !== puzzle.solution[index]);
}

function completeGame(): void {
  phase = 'won';
  stopTimer();
  const score = calculateScore({ difficultyId, elapsedSeconds, mistakes, hints });
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
    elapsedSeconds += 1;
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

function moveSelection(key: string): void {
  if (selectedIndex === null) {
    selectedIndex = 0;
    render();
    return;
  }

  const row = Math.floor(selectedIndex / BOARD_SIZE);
  const column = selectedIndex % BOARD_SIZE;

  if (key === 'ArrowUp') {
    selectedIndex = Math.max(0, row - 1) * BOARD_SIZE + column;
  }

  if (key === 'ArrowDown') {
    selectedIndex = Math.min(BOARD_SIZE - 1, row + 1) * BOARD_SIZE + column;
  }

  if (key === 'ArrowLeft') {
    selectedIndex = row * BOARD_SIZE + Math.max(0, column - 1);
  }

  if (key === 'ArrowRight') {
    selectedIndex = row * BOARD_SIZE + Math.min(BOARD_SIZE - 1, column + 1);
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
  const score = calculateScore({ difficultyId, elapsedSeconds, mistakes, hints });

  levelElement.textContent = puzzle.difficulty.label;
  timeElement.textContent = formatTime(elapsedSeconds);
  mistakesElement.textContent = `${mistakes} / H${hints}`;
  bestElement.textContent = formatBestScore(loadBestScore(difficultyId), score);
  selectedLabel.textContent =
    selectedIndex === null
      ? '--'
      : `R${Math.floor(selectedIndex / BOARD_SIZE) + 1} C${(selectedIndex % BOARD_SIZE) + 1}`;
}

function renderBoard(): void {
  const conflictIndexes = getConflictingIndexes(values);
  const peerIndexes = selectedIndex === null ? new Set<number>() : new Set(getPeerIndexes(selectedIndex));
  const selectedValue = selectedIndex === null ? EMPTY : values[selectedIndex] ?? EMPTY;

  boardElement.innerHTML = values.map((value, index) => {
    const classes = ['cell'];
    const isGiven = puzzle.givenIndexes.has(index);
    const isSelected = selectedIndex === index;
    const isWrong = !isGiven && value !== EMPTY && value !== puzzle.solution[index];

    if (isGiven) {
      classes.push('cell--given');
    }

    if (isSelected) {
      classes.push('is-selected');
    }

    if (peerIndexes.has(index)) {
      classes.push('is-peer');
    }

    if (selectedValue !== EMPTY && value === selectedValue) {
      classes.push('is-same');
    }

    if (conflictIndexes.has(index)) {
      classes.push('is-conflict');
    }

    if (isWrong) {
      classes.push('is-wrong');
    }

    if (index % 3 === 0) {
      classes.push('cell--box-left');
    }

    if (Math.floor(index / 9) % 3 === 0) {
      classes.push('cell--box-top');
    }

    return `
      <button
        class="${classes.join(' ')}"
        data-index="${index}"
        type="button"
        role="gridcell"
        aria-label="${Math.floor(index / BOARD_SIZE) + 1}행 ${(index % BOARD_SIZE) + 1}열"
        aria-selected="${isSelected ? 'true' : 'false'}"
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
    overlayTitle.textContent = `${formatTime(elapsedSeconds)} / ${calculateScore({
      difficultyId,
      elapsedSeconds,
      mistakes,
      hints,
    })}점`;
    overlayAction.textContent = 'New Game';
  }

  if (phase === 'stopped') {
    overlayKicker.textContent = 'STOPPED';
    overlayTitle.textContent = '게임 종료';
    overlayAction.textContent = 'New Game';
  }
}

function findFirstEditableIndex(nextPuzzle: SudokuPuzzle): number | null {
  const index = nextPuzzle.puzzle.findIndex((value) => value === EMPTY);
  return index >= 0 ? index : null;
}

function getCellButton(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest<HTMLButtonElement>('[data-index]');
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
      gameSlug: 'sudoku',
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
      gameSlug: 'sudoku',
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

function formatBestScore(bestScore: number | null, currentScore: number): string {
  if (phase === 'playing' || phase === 'paused') {
    return bestScore === null ? currentScore.toString() : `${bestScore}`;
  }

  return bestScore === null ? '--' : bestScore.toString();
}

function mustQuery<TElement extends Element>(selector: string): TElement {
  const element = appRoot.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Missing UI element: ${selector}`);
  }

  return element;
}
