import {
  forceGameOver,
  getBallSpeed,
  getKeyboardInput,
  pauseGame,
  resetRound,
  resumeGame,
  startGame,
  tickGame,
  type PlayerInput,
  type PongState,
  createGameState,
} from './game';
import './styles.css';

const GAME_SLUG = 'pong-duel';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;

let state = createGameState();
let frameId: number | null = null;
let lastFrameTime = 0;
const activeInputs = new Set<PlayerInput>();

appRoot.innerHTML = `
  <main class="shell" data-shell>
    <header class="topbar">
      <div class="brand">
        <p>PONG DUEL</p>
        <h1>Pong Duel</h1>
      </div>
      <div class="actions">
        <button type="button" data-action="toggle">Start</button>
        <button type="button" data-action="restart">New</button>
      </div>
    </header>

    <section class="hud" aria-label="Game status">
      <div>
        <span>PLAYER</span>
        <strong data-player-score>00</strong>
      </div>
      <div>
        <span>ROUND</span>
        <strong data-round>01</strong>
      </div>
      <div>
        <span>RALLY</span>
        <strong data-rally>00</strong>
      </div>
      <div>
        <span>SPEED</span>
        <strong data-speed>0.00</strong>
      </div>
      <div>
        <span>AI</span>
        <strong data-ai-score>00</strong>
      </div>
    </section>

    <section class="stage" aria-label="Pong Duel play area">
      <section class="arena" data-arena aria-label="Pong Duel arena">
        <span class="net" aria-hidden="true"></span>
        <span class="paddle paddle--player" data-player-paddle></span>
        <span class="paddle paddle--ai" data-ai-paddle></span>
        <span class="ball" data-ball></span>
      </section>
      <div class="overlay" data-overlay aria-live="polite">
        <strong data-status-title>READY</strong>
        <span data-status-help>SPACE TO START</span>
      </div>
    </section>
  </main>
`;

const shell = queryElement<HTMLElement>('[data-shell]');
const playerPaddle = queryElement<HTMLElement>('[data-player-paddle]');
const aiPaddle = queryElement<HTMLElement>('[data-ai-paddle]');
const ball = queryElement<HTMLElement>('[data-ball]');
const overlay = queryElement<HTMLElement>('[data-overlay]');
const statusTitle = queryElement<HTMLElement>('[data-status-title]');
const statusHelp = queryElement<HTMLElement>('[data-status-help]');
const playerScoreElement = queryElement<HTMLElement>('[data-player-score]');
const aiScoreElement = queryElement<HTMLElement>('[data-ai-score]');
const roundElement = queryElement<HTMLElement>('[data-round]');
const rallyElement = queryElement<HTMLElement>('[data-rally]');
const speedElement = queryElement<HTMLElement>('[data-speed]');
const toggleButton = queryElement<HTMLButtonElement>('[data-action="toggle"]');
const restartButton = queryElement<HTMLButtonElement>('[data-action="restart"]');

toggleButton.addEventListener('click', togglePlay);
restartButton.addEventListener('click', restartGame);
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);
window.addEventListener('message', handleHubMessage);
window.parent.postMessage({ type: 'minigame:ready', gameSlug: GAME_SLUG }, '*');

render();

function handleKeyDown(event: KeyboardEvent): void {
  const input = getKeyboardInput(event.code) ?? getKeyboardInput(event.key);

  if (input) {
    event.preventDefault();
    activeInputs.add(input);

    if (state.phase === 'ready') {
      play();
    }

    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    togglePlay();
    return;
  }

  if (event.code === 'Enter') {
    event.preventDefault();
    restartGame();
  }
}

function handleKeyUp(event: KeyboardEvent): void {
  const input = getKeyboardInput(event.code) ?? getKeyboardInput(event.key);

  if (input) {
    activeInputs.delete(input);
  }
}

function handleHubMessage(event: MessageEvent): void {
  const action = getHubAction(event.data);

  if (!action) {
    return;
  }

  if (action === 'start') {
    play();
    return;
  }

  if (action === 'pause') {
    pause();
    return;
  }

  if (action === 'gameOver') {
    finishGameFromHub();
    return;
  }

  restartGame();
}

function togglePlay(): void {
  if (state.phase === 'playing') {
    pause();
    return;
  }

  if (state.phase === 'game-over') {
    restartGame();
    play();
    return;
  }

  play();
}

function play(): void {
  if (state.phase === 'paused') {
    state = resumeGame(state);
  } else if (state.phase === 'round-over') {
    state = resetRound(state);
  } else {
    state = startGame(state);
  }

  render();

  if (state.phase === 'playing') {
    requestLoop();
    window.parent.postMessage({ type: 'minigame:start', gameSlug: GAME_SLUG }, '*');
  }
}

function pause(): void {
  cancelLoop();
  state = pauseGame(state);
  render();
  window.parent.postMessage({ type: 'minigame:pause', gameSlug: GAME_SLUG }, '*');
}

function restartGame(): void {
  cancelLoop();
  activeInputs.clear();
  state = createGameState();
  lastFrameTime = 0;
  render();
}

function finishGameFromHub(): void {
  cancelLoop();
  state = forceGameOver(state);
  render();
}

function requestLoop(): void {
  if (frameId !== null) {
    return;
  }

  lastFrameTime = performance.now();
  frameId = window.requestAnimationFrame(tick);
}

function cancelLoop(): void {
  if (frameId === null) {
    return;
  }

  window.cancelAnimationFrame(frameId);
  frameId = null;
}

function tick(time: number): void {
  frameId = null;

  if (state.phase !== 'playing') {
    return;
  }

  const deltaMs = Math.min(64, time - lastFrameTime);
  lastFrameTime = time;
  state = tickGame(state, deltaMs, getCurrentInput());
  render();

  if (state.phase === 'round-over') {
    window.parent.postMessage(
      {
        type: 'minigame:score',
        gameSlug: GAME_SLUG,
        score: state.playerScore,
      },
      '*',
    );
    return;
  }

  if (state.phase === 'game-over') {
    postGameOver();
    return;
  }

  frameId = window.requestAnimationFrame(tick);
}

function getCurrentInput(): PlayerInput {
  if (activeInputs.has('up')) {
    return 'up';
  }

  if (activeInputs.has('down')) {
    return 'down';
  }

  return 'none';
}

function render(): void {
  shell.dataset.phase = state.phase;
  playerPaddle.style.top = `${state.player.y * 100}%`;
  playerPaddle.style.height = `${state.player.height * 100}%`;
  aiPaddle.style.top = `${state.ai.y * 100}%`;
  aiPaddle.style.height = `${state.ai.height * 100}%`;
  ball.style.left = `${state.ball.x * 100}%`;
  ball.style.top = `${state.ball.y * 100}%`;
  ball.style.width = `${state.ball.radius * 200}%`;
  playerScoreElement.textContent = String(state.playerScore).padStart(2, '0');
  aiScoreElement.textContent = String(state.aiScore).padStart(2, '0');
  roundElement.textContent = String(state.round).padStart(2, '0');
  rallyElement.textContent = String(state.rally).padStart(2, '0');
  speedElement.textContent = getBallSpeed(state.ball).toFixed(2);
  toggleButton.textContent = getToggleLabel(state);
  overlay.hidden = state.phase === 'playing';
  statusTitle.textContent = getStatusTitle(state);
  statusHelp.textContent = getStatusHelp(state);
}

function getToggleLabel(current: PongState): string {
  if (current.phase === 'playing') {
    return 'Pause';
  }

  if (current.phase === 'game-over') {
    return 'Retry';
  }

  return 'Start';
}

function getStatusTitle(current: PongState): string {
  if (current.phase === 'paused') {
    return 'PAUSED';
  }

  if (current.phase === 'round-over') {
    return `${current.lastScorer === 'player' ? 'PLAYER' : 'AI'} SCORED`;
  }

  if (current.phase === 'game-over') {
    return current.playerScore > current.aiScore ? 'YOU WIN' : 'AI WINS';
  }

  return 'READY';
}

function getStatusHelp(current: PongState): string {
  if (current.phase === 'paused') {
    return 'SPACE TO RESUME';
  }

  if (current.phase === 'round-over') {
    return 'SPACE FOR NEXT ROUND';
  }

  if (current.phase === 'game-over') {
    return 'ENTER TO RESET';
  }

  return 'W/S OR ARROWS';
}

function postGameOver(): void {
  window.parent.postMessage(
    {
      type: 'minigame:game-over',
      gameSlug: GAME_SLUG,
      score: state.playerScore,
    },
    '*',
  );
}

function queryElement<T extends HTMLElement>(selector: string): T {
  const element = appRoot.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Element was not found: ${selector}`);
  }

  return element;
}

function getHubAction(value: unknown): 'start' | 'pause' | 'gameOver' | 'reset' | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const message = value as {
    action?: unknown;
    command?: unknown;
    gameSlug?: unknown;
    slug?: unknown;
    source?: unknown;
    type?: unknown;
  };
  const targetSlug = message.gameSlug ?? message.slug;

  if (targetSlug && targetSlug !== GAME_SLUG) {
    return null;
  }

  const action = message.action ?? message.command;

  if (
    message.source === 'minigame-hub' &&
    (action === 'start' || action === 'pause' || action === 'gameOver')
  ) {
    return action;
  }

  if (
    message.type === 'minigame:control' &&
    (action === 'start' || action === 'pause' || action === 'reset')
  ) {
    return action;
  }

  return null;
}
