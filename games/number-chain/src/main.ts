import './styles.css';
import {
  STORAGE_KEY,
  computeRoundScore,
  createStageConfig,
  generateBoard,
  parseBest,
  type BoardSpec,
  type PersistedBest,
} from './game';

type RuntimeState = 'idle' | 'running' | 'paused' | 'stage-clear' | 'game-over';
type HubCommand = 'start' | 'pause' | 'gameOver';

interface HubMessage {
  readonly source: 'minigame-hub';
  readonly command: HubCommand;
  readonly gameSlug: string;
}

const GAME_SLUG = 'number-chain';
const app = queryElement<HTMLDivElement>('#app');

app.innerHTML = `
  <main class="shell">
    <section class="sidebar">
      <p class="eyebrow">Path Puzzle</p>
      <h1>Number Chain</h1>
      <p class="subtitle">1부터 순서대로 인접한 숫자를 찾아 연결하는 스테이지형 퍼즐입니다.</p>
      <div class="stats">
        <article><span>Score</span><strong data-score>0</strong></article>
        <article><span>Best</span><strong data-best>0</strong></article>
        <article><span>Stage</span><strong data-stage>1</strong></article>
        <article><span>Next</span><strong data-next>1</strong></article>
        <article><span>Time</span><strong data-time>0.0</strong></article>
        <article><span>Mistakes</span><strong data-mistakes>0 / 3</strong></article>
      </div>
      <div class="controls">
        <button type="button" data-action="start">Start</button>
        <button type="button" data-action="pause">Pause</button>
        <button type="button" data-action="reset">Reset</button>
      </div>
      <div class="status-card">
        <p class="status" data-status>Start를 누르면 1부터 순서대로 클릭하는 라운드가 시작됩니다.</p>
      </div>
    </section>
    <section class="board-panel">
      <div class="board" data-board aria-label="number chain board"></div>
    </section>
  </main>
`;

const scoreValue = queryElement<HTMLElement>('[data-score]');
const bestValue = queryElement<HTMLElement>('[data-best]');
const stageValue = queryElement<HTMLElement>('[data-stage]');
const nextValue = queryElement<HTMLElement>('[data-next]');
const timeValue = queryElement<HTMLElement>('[data-time]');
const mistakesValue = queryElement<HTMLElement>('[data-mistakes]');
const statusValue = queryElement<HTMLElement>('[data-status]');
const boardElement = queryElement<HTMLDivElement>('[data-board]');
const actionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action]'));

let state: RuntimeState = 'idle';
let stage = 1;
let score = 0;
let remainingMs = 0;
let mistakes = 0;
let streak = 0;
let nextTarget = 1;
let currentBoard: BoardSpec | null = null;
let lastFrame = 0;
let best = loadBest();

bestValue.textContent = String(best?.score ?? 0);
renderBoard(generateBoard(stage));
renderStats();

actionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;

    if (action === 'start') {
      startGame(state === 'paused');
    }

    if (action === 'pause') {
      togglePause();
    }

    if (action === 'reset') {
      resetGame();
    }
  });
});

window.addEventListener('message', (event: MessageEvent<HubMessage>) => {
  if (!event.data || event.data.source !== 'minigame-hub' || event.data.gameSlug !== GAME_SLUG) {
    return;
  }

  if (event.data.command === 'start') {
    startGame(state === 'paused');
  }

  if (event.data.command === 'pause' && state === 'running') {
    state = 'paused';
    setStatus('허브에서 일시정지되었습니다.');
  }

  if (event.data.command === 'gameOver') {
    endGame('허브에서 종료 요청이 들어왔습니다.');
  }
});

requestAnimationFrame(frame);

function startGame(resumeOnly: boolean): void {
  if (!resumeOnly) {
    stage = 1;
    score = 0;
    mistakes = 0;
    streak = 0;
    setupStage();
  } else {
    state = 'running';
    lastFrame = performance.now();
    setStatus('게임을 재개했습니다.');
  }
}

function setupStage(): void {
  currentBoard = generateBoard(stage);
  remainingMs = createStageConfig(stage).timeLimitMs;
  nextTarget = 1;
  mistakes = 0;
  renderBoard(currentBoard);
  state = 'running';
  lastFrame = performance.now();
  renderStats();
  setStatus(`Stage ${stage} 시작. 숫자 ${nextTarget}부터 순서대로 클릭하세요.`);
}

function togglePause(): void {
  if (state === 'running') {
    state = 'paused';
    setStatus('일시정지되었습니다.');
    return;
  }

  if (state === 'paused') {
    state = 'running';
    lastFrame = performance.now();
    setStatus('게임을 재개했습니다.');
  }
}

function resetGame(): void {
  state = 'idle';
  stage = 1;
  score = 0;
  mistakes = 0;
  streak = 0;
  nextTarget = 1;
  remainingMs = 0;
  currentBoard = generateBoard(stage);
  renderBoard(currentBoard);
  renderStats();
  setStatus('리셋되었습니다. Start를 누르면 다시 시작합니다.');
}

function frame(timestamp: number): void {
  if (state === 'running') {
    const delta = Math.min(64, timestamp - lastFrame);
    remainingMs = Math.max(0, remainingMs - delta);

    if (remainingMs === 0) {
      endGame('시간이 초과되었습니다.');
    }
  }

  lastFrame = timestamp;
  renderStats();
  requestAnimationFrame(frame);
}

function renderBoard(board: BoardSpec): void {
  currentBoard = board;
  boardElement.innerHTML = '';
  boardElement.style.setProperty('--grid-size', String(board.size));

  board.cells.forEach((cell, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tile';
    button.textContent = String(cell.value);
    button.dataset.value = String(cell.value);
    button.addEventListener('click', () => handleCellClick(index));
    boardElement.append(button);
  });
}

function handleCellClick(index: number): void {
  if (state !== 'running' || !currentBoard) {
    return;
  }

  const cell = currentBoard.cells[index];

  if (cell.value === nextTarget) {
    const tile = boardElement.children.item(index);

    if (tile instanceof HTMLElement) {
      tile.classList.add('cleared');
    }

    nextTarget += 1;
    setStatus(`정답. 다음 숫자 ${nextTarget}를 찾으세요.`);

    if (nextTarget > createStageConfig(stage).targetLength) {
      score += computeRoundScore(stage, remainingMs, streak);
      score += createStageConfig(stage).stageBonus;
      streak += 1;
      stage += 1;
      state = 'stage-clear';
      renderStats();
      setStatus(`Stage ${stage - 1} 클리어. 다음 스테이지를 준비합니다.`);
      window.setTimeout(() => {
        if (state === 'stage-clear') {
          setupStage();
        }
      }, 700);
      return;
    }

    renderStats();
    return;
  }

  mistakes += 1;
  streak = 0;
  remainingMs = Math.max(0, remainingMs - 1800);
  setStatus(`오답입니다. 남은 실수 ${3 - mistakes}회.`);
  renderStats();

  if (mistakes >= 3) {
    endGame('오답 3회로 게임이 종료되었습니다.');
  }
}

function endGame(message: string): void {
  state = 'game-over';
  persistBest();
  renderStats();
  setStatus(`${message} Start로 다시 시작할 수 있습니다.`);
  notifyHubGameOver();
}

function notifyHubGameOver(): void {
  if (window.parent === window) {
    return;
  }

  window.parent.postMessage(
    {
      source: GAME_SLUG,
      type: 'minigame:game-over',
      payload: {
        score,
        stage,
      },
    },
    '*',
  );
}

function persistBest(): void {
  if (!best || score > best.score) {
    best = {
      score,
      stage,
      createdAt: new Date().toISOString(),
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(best));
    bestValue.textContent = String(best.score);
  }
}

function loadBest(): PersistedBest | null {
  return parseBest(window.localStorage.getItem(STORAGE_KEY));
}

function renderStats(): void {
  scoreValue.textContent = String(score);
  stageValue.textContent = String(stage);
  nextValue.textContent = String(nextTarget);
  timeValue.textContent = (remainingMs / 1000).toFixed(1);
  mistakesValue.textContent = `${mistakes} / 3`;
}

function setStatus(message: string): void {
  statusValue.textContent = message;
}

function queryElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  return element;
}
