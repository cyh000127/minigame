import './styles.css';
import {
  STORAGE_KEY,
  computeRoundScore,
  createSequence,
  createStageSpec,
  parseBest,
  type PersistedBest,
} from './game';

type RuntimeState = 'idle' | 'revealing' | 'input' | 'paused' | 'stage-clear' | 'game-over';
type HubCommand = 'start' | 'pause' | 'gameOver';

interface HubMessage {
  readonly source: 'minigame-hub';
  readonly command: HubCommand;
  readonly gameSlug: string;
}

const GAME_SLUG = 'safe-cracker';
const app = queryElement<HTMLDivElement>('#app');

app.innerHTML = `
  <main class="shell">
    <section class="sidebar">
      <p class="eyebrow">Code Memory</p>
      <h1>Safe Cracker</h1>
      <p class="subtitle">잠깐 보이는 숫자 코드를 기억해 금고를 연속으로 해제하세요.</p>
      <div class="stats">
        <article><span>Score</span><strong data-score>0</strong></article>
        <article><span>Best</span><strong data-best>0</strong></article>
        <article><span>Stage</span><strong data-stage>1</strong></article>
        <article><span>Cracks</span><strong data-cracks>0 / 3</strong></article>
        <article><span>Time</span><strong data-time>0.0</strong></article>
        <article><span>Strikes</span><strong data-strikes>0 / 3</strong></article>
      </div>
      <div class="controls">
        <button type="button" data-action="start">Start</button>
        <button type="button" data-action="pause">Pause</button>
        <button type="button" data-action="reset">Reset</button>
      </div>
      <div class="status-card">
        <p class="status" data-status>Start를 누르면 첫 코드가 공개됩니다.</p>
        <p class="hint">숫자 버튼이나 키보드 숫자 입력 후 Enter로 제출합니다.</p>
      </div>
    </section>
    <section class="board">
      <div class="display">
        <div class="display-label">CODE</div>
        <div class="display-code" data-code>---</div>
      </div>
      <div class="entry">
        <label class="entry-label" for="entry-input">입력 코드</label>
        <input id="entry-input" data-entry inputmode="numeric" maxlength="12" autocomplete="off" />
        <div class="entry-actions">
          <button type="button" data-action="submit">Submit</button>
          <button type="button" data-action="clear">Clear</button>
        </div>
      </div>
      <div class="keypad" data-keypad></div>
    </section>
  </main>
`;

const scoreValue = queryElement<HTMLElement>('[data-score]');
const bestValue = queryElement<HTMLElement>('[data-best]');
const stageValue = queryElement<HTMLElement>('[data-stage]');
const cracksValue = queryElement<HTMLElement>('[data-cracks]');
const timeValue = queryElement<HTMLElement>('[data-time]');
const strikesValue = queryElement<HTMLElement>('[data-strikes]');
const statusValue = queryElement<HTMLElement>('[data-status]');
const codeValue = queryElement<HTMLElement>('[data-code]');
const entryInput = queryElement<HTMLInputElement>('[data-entry]');
const keypad = queryElement<HTMLDivElement>('[data-keypad]');
const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action]'));

let state: RuntimeState = 'idle';
let stage = 1;
let score = 0;
let cracks = 0;
let strikes = 0;
let streak = 0;
let remainingMs = 0;
let currentSequence = '';
let revealToken = 0;
let lastFrame = 0;
let best = loadBest();

bestValue.textContent = String(best?.score ?? 0);
buildKeypad();
renderStats();

buttons.forEach((button) => {
  button.addEventListener('click', () => handleAction(button.dataset.action ?? ''));
});

entryInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    submitEntry();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key >= '0' && event.key <= '9') {
    if (document.activeElement !== entryInput) {
      appendDigit(event.key);
    }
  }

  if (event.key === 'Backspace' && document.activeElement !== entryInput) {
    entryInput.value = entryInput.value.slice(0, -1);
  }
});

window.addEventListener('message', (event: MessageEvent<HubMessage>) => {
  if (!event.data || event.data.source !== 'minigame-hub' || event.data.gameSlug !== GAME_SLUG) {
    return;
  }

  if (event.data.command === 'start') {
    startGame(state === 'paused');
  }

  if (event.data.command === 'pause' && state === 'input') {
    state = 'paused';
    setStatus('허브에서 일시정지되었습니다.');
  }

  if (event.data.command === 'gameOver') {
    endGame('허브에서 종료 요청이 들어왔습니다.');
  }
});

requestAnimationFrame(frame);

function handleAction(action: string): void {
  switch (action) {
    case 'start':
      startGame(state === 'paused');
      break;
    case 'pause':
      togglePause();
      break;
    case 'reset':
      resetGame();
      break;
    case 'submit':
      submitEntry();
      break;
    case 'clear':
      entryInput.value = '';
      break;
    default:
      break;
  }
}

function startGame(resumeOnly: boolean): void {
  if (!resumeOnly) {
    stage = 1;
    score = 0;
    cracks = 0;
    strikes = 0;
    streak = 0;
  }

  beginRound();
}

function beginRound(): void {
  const spec = createStageSpec(stage);
  currentSequence = createSequence(spec.sequenceLength);
  entryInput.value = '';
  codeValue.textContent = currentSequence;
  state = 'revealing';
  remainingMs = spec.inputTimeMs;
  revealToken += 1;
  const token = revealToken;

  renderStats();
  setStatus(`Stage ${stage} 코드 공개 중입니다.`);

  window.setTimeout(() => {
    if (token !== revealToken || state === 'paused' || state === 'game-over') {
      return;
    }

    codeValue.textContent = '•'.repeat(spec.sequenceLength);
    state = 'input';
    lastFrame = performance.now();
    setStatus('코드를 입력하고 Submit 하세요.');
    entryInput.focus();
  }, spec.revealMs);
}

function togglePause(): void {
  if (state === 'input') {
    state = 'paused';
    setStatus('일시정지되었습니다.');
    return;
  }

  if (state === 'paused') {
    state = 'input';
    lastFrame = performance.now();
    setStatus('게임을 재개했습니다.');
  }
}

function resetGame(): void {
  revealToken += 1;
  state = 'idle';
  stage = 1;
  score = 0;
  cracks = 0;
  strikes = 0;
  streak = 0;
  remainingMs = 0;
  currentSequence = '';
  entryInput.value = '';
  codeValue.textContent = '---';
  renderStats();
  setStatus('리셋되었습니다. Start를 누르면 다시 시작합니다.');
}

function submitEntry(): void {
  if (state !== 'input') {
    return;
  }

  if (entryInput.value === currentSequence) {
    streak += 1;
    cracks += 1;
    score += computeRoundScore(stage, remainingMs, streak);
    const spec = createStageSpec(stage);

    if (cracks >= spec.roundTarget) {
      score += spec.roundBonus;
      stage += 1;
      cracks = 0;
      strikes = 0;
      streak = 0;
      state = 'stage-clear';
      renderStats();
      setStatus(`Stage ${stage - 1} 클리어. 다음 금고로 이동합니다.`);
      window.setTimeout(() => {
        if (state === 'stage-clear') {
          beginRound();
        }
      }, 700);
      return;
    }

    setStatus(`해제 성공. 현재 연속 성공 ${streak}회입니다.`);
    beginRound();
    return;
  }

  strikes += 1;
  streak = 0;
  entryInput.value = '';
  setStatus(`오답입니다. 남은 기회 ${3 - strikes}회.`);

  if (strikes >= 3) {
    endGame('오답 3회로 게임이 종료되었습니다.');
  }

  renderStats();
}

function frame(timestamp: number): void {
  if (state === 'input') {
    const delta = Math.min(64, timestamp - lastFrame);
    remainingMs = Math.max(0, remainingMs - delta);

    if (remainingMs === 0) {
      endGame('입력 시간이 초과되었습니다.');
    }
  }

  lastFrame = timestamp;
  renderStats();
  requestAnimationFrame(frame);
}

function appendDigit(digit: string): void {
  const maxLength = createStageSpec(stage).sequenceLength;

  if (entryInput.value.length >= maxLength) {
    return;
  }

  entryInput.value += digit;
}

function buildKeypad(): void {
  for (let digit = 1; digit <= 9; digit += 1) {
    keypad.append(createDigitButton(String(digit)));
  }

  keypad.append(createDigitButton('0'));
}

function createDigitButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'digit';
  button.textContent = label;
  button.addEventListener('click', () => appendDigit(label));
  return button;
}

function endGame(message: string): void {
  revealToken += 1;
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
  const spec = createStageSpec(stage);
  scoreValue.textContent = String(score);
  stageValue.textContent = String(stage);
  cracksValue.textContent = `${cracks} / ${spec.roundTarget}`;
  timeValue.textContent = (remainingMs / 1000).toFixed(1);
  strikesValue.textContent = `${strikes} / 3`;
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
