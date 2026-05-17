import './styles.css';
import {
  STORAGE_KEY,
  computeCorrectScore,
  computeStageClearBonus,
  createDifficulty,
  createRound,
  parseBestScore,
  type PersistedScore,
  type RoundSpec,
} from './game';

type RuntimeState = 'idle' | 'running' | 'paused' | 'stage-clear' | 'game-over';
type HubCommand = 'start' | 'pause' | 'gameOver';

interface HubMessage {
  readonly source: 'minigame-hub';
  readonly command: HubCommand;
  readonly gameSlug: string;
}

const GAME_SLUG = 'odd-one-out';
const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found.');
}

app.innerHTML = `
  <main class="shell">
    <section class="hud-panel">
      <div class="title-wrap">
        <p class="eyebrow">Visual Reflex</p>
        <h1>Odd One Out</h1>
        <p class="subtitle">다른 색 타일 하나를 제한시간 안에 계속 찾아 스테이지를 넘기세요.</p>
      </div>
      <div class="stats">
        <article><span>Score</span><strong data-score>0</strong></article>
        <article><span>Best</span><strong data-best>0</strong></article>
        <article><span>Stage</span><strong data-stage>1</strong></article>
        <article><span>Finds</span><strong data-finds>0 / 4</strong></article>
        <article><span>Time</span><strong data-time>34.0</strong></article>
        <article><span>Mistakes</span><strong data-mistakes>0 / 3</strong></article>
      </div>
      <div class="controls">
        <button type="button" data-action="start">Start</button>
        <button type="button" data-action="pause">Pause</button>
        <button type="button" data-action="reset">Reset</button>
      </div>
      <div class="status-card">
        <p class="status" data-status>Start를 누르면 첫 스테이지가 시작됩니다.</p>
        <p class="hint">클릭 오답 3회 또는 시간초과 시 종료됩니다.</p>
      </div>
    </section>
    <section class="board-panel">
      <div class="board" data-board aria-label="odd one out board"></div>
    </section>
  </main>
`;

const scoreValue = queryText('[data-score]');
const bestValue = queryText('[data-best]');
const stageValue = queryText('[data-stage]');
const findsValue = queryText('[data-finds]');
const timeValue = queryText('[data-time]');
const mistakesValue = queryText('[data-mistakes]');
const statusValue = queryText('[data-status]');
const board = queryElement<HTMLDivElement>('[data-board]');

const controls = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action]'));

let state: RuntimeState = 'idle';
let score = 0;
let stage = 1;
let finds = 0;
let mistakes = 0;
let streak = 0;
let remainingMs = createDifficulty(1).timeLimitMs;
let lastFrame = 0;
let activeRound: RoundSpec | null = null;
let bestScore = loadBestScore();

bestValue.textContent = String(bestScore?.score ?? 0);
renderStats();
renderBoard(createRound(stage));
setStatus('Start를 누르면 첫 스테이지가 시작됩니다.');

controls.forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;

    switch (action) {
      case 'start':
        if (state === 'paused' || state === 'idle' || state === 'game-over') {
          startGame(state === 'paused');
        }
        break;
      case 'pause':
        togglePause();
        break;
      case 'reset':
        resetGame();
        break;
      default:
        break;
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

  if (event.data.command === 'pause') {
    if (state === 'running') {
      state = 'paused';
      setStatus('허브에서 일시정지되었습니다.');
    }
  }

  if (event.data.command === 'gameOver') {
    endGame('허브에서 게임 종료가 요청되었습니다.');
  }
});

requestAnimationFrame(frame);

function startGame(resumeOnly: boolean): void {
  if (!resumeOnly) {
    score = 0;
    stage = 1;
    finds = 0;
    mistakes = 0;
    streak = 0;
    remainingMs = createDifficulty(stage).timeLimitMs;
    activeRound = createRound(stage);
    renderBoard(activeRound);
  }

  state = 'running';
  lastFrame = performance.now();
  setStatus(`Stage ${stage} 진행 중. 다른 타일 하나를 찾으세요.`);
  renderStats();
}

function togglePause(): void {
  if (state === 'running') {
    state = 'paused';
    setStatus('일시정지되었습니다.');
    return;
  }

  if (state === 'paused') {
    startGame(true);
  }
}

function resetGame(): void {
  state = 'idle';
  score = 0;
  stage = 1;
  finds = 0;
  mistakes = 0;
  streak = 0;
  remainingMs = createDifficulty(stage).timeLimitMs;
  activeRound = createRound(stage);
  renderBoard(activeRound);
  renderStats();
  setStatus('리셋되었습니다. Start를 누르면 다시 시작됩니다.');
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

function renderBoard(round: RoundSpec): void {
  activeRound = round;
  board.innerHTML = '';
  board.style.setProperty('--grid-size', String(round.gridSize));

  const totalTiles = round.gridSize * round.gridSize;

  for (let index = 0; index < totalTiles; index += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tile';
    button.style.background = index === round.oddIndex ? round.colors.odd : round.colors.base;
    button.dataset.index = String(index);
    button.setAttribute('aria-label', `tile ${index + 1}`);
    button.addEventListener('click', () => handleTileClick(index));
    board.append(button);
  }
}

function handleTileClick(index: number): void {
  if (state !== 'running' || !activeRound) {
    return;
  }

  if (index === activeRound.oddIndex) {
    finds += 1;
    streak += 1;
    score += computeCorrectScore(stage, remainingMs, streak);

    const difficulty = createDifficulty(stage);

    if (finds >= difficulty.findsToClear) {
      score += computeStageClearBonus(stage);
      stage += 1;
      finds = 0;
      mistakes = 0;
      streak = 0;
      remainingMs = createDifficulty(stage).timeLimitMs;
      renderBoard(createRound(stage));
      state = 'stage-clear';
      renderStats();
      setStatus(`Stage ${stage - 1} 클리어. 다음 스테이지로 이동합니다.`);

      window.setTimeout(() => {
        if (state === 'stage-clear') {
          state = 'running';
          setStatus(`Stage ${stage} 진행 중. 난이도가 상승했습니다.`);
        }
      }, 600);

      return;
    }

    remainingMs = Math.min(createDifficulty(stage).timeLimitMs, remainingMs + 1400);
    renderBoard(createRound(stage));
    setStatus(`정답. 연속 ${streak}회 성공 중입니다.`);
    renderStats();
    return;
  }

  mistakes += 1;
  streak = 0;
  remainingMs = Math.max(0, remainingMs - 2200);
  setStatus(`오답입니다. ${3 - mistakes}번 더 틀리면 종료됩니다.`);

  if (mistakes >= 3) {
    endGame('오답 3회로 게임이 종료되었습니다.');
  }
}

function endGame(message: string): void {
  state = 'game-over';
  persistBestScore();
  renderStats();
  setStatus(`${message} Reset 또는 Start로 다시 시작할 수 있습니다.`);
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

function persistBestScore(): void {
  if (!bestScore || score > bestScore.score) {
    bestScore = {
      score,
      stage,
      createdAt: new Date().toISOString(),
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bestScore));
    bestValue.textContent = String(bestScore.score);
  }
}

function loadBestScore(): PersistedScore | null {
  return parseBestScore(window.localStorage.getItem(STORAGE_KEY));
}

function renderStats(): void {
  const difficulty = createDifficulty(stage);
  scoreValue.textContent = String(score);
  stageValue.textContent = String(stage);
  findsValue.textContent = `${finds} / ${difficulty.findsToClear}`;
  timeValue.textContent = (remainingMs / 1000).toFixed(1);
  mistakesValue.textContent = `${mistakes} / 3`;
}

function setStatus(message: string): void {
  statusValue.textContent = message;
}

function queryText(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  return element;
}

function queryElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  return element;
}
