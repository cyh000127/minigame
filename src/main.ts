import './styles.css';
import {
  createGameUrl,
  createLifecycleMessage,
  DEFAULT_GAME,
  findGameBySlug,
  GAMES,
  type GameEntry,
  type MiniGameRuntime,
} from './launcher';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

const appRoot = app;

appRoot.innerHTML = `
  <main class="hub-shell">
    <header class="topbar">
      <div>
        <p>MINIGAME HEAVEN</p>
        <h1>게임 실행기</h1>
      </div>
      <div class="topbar__meta">
        <span>${GAMES.length.toString().padStart(2, '0')} GAMES</span>
        <strong data-active-title>SELECT</strong>
      </div>
    </header>

    <section class="hub-layout" aria-label="Minigame launcher">
      <aside class="selector" aria-label="Game selector">
        <div class="selector__head">
          <span>SELECT GAME</span>
          <strong data-selected-count>${GAMES.length}</strong>
        </div>
        <div class="game-list" data-game-list></div>
      </aside>

      <section class="runner" aria-label="Game runner">
        <div class="runner__toolbar">
          <div>
            <span data-runner-genre>READY</span>
            <strong data-runner-title>게임을 선택하세요</strong>
          </div>
          <div class="runner__actions">
            <button class="icon-button" data-start type="button" aria-label="게임 실행">
              <span class="play-mark"></span>
              RUN
            </button>
            <button class="icon-button" data-pause type="button" aria-label="게임 일시정지">
              ||
            </button>
            <button class="icon-button" data-game-over type="button" aria-label="게임 종료">
              END
            </button>
            <a class="open-link" data-open-link href="#" target="_blank" rel="noreferrer">OPEN</a>
          </div>
        </div>

        <div class="stage" data-stage>
          <iframe data-frame title="Selected minigame" loading="lazy"></iframe>
          <div class="stage__empty" data-stage-empty>
            <span>READY</span>
            <strong>게임을 고르면 이 영역에서 실행됩니다</strong>
          </div>
          <div class="stage__pause" data-stage-pause>
            <span data-pause-label>PAUSED</span>
            <strong data-pause-title></strong>
          </div>
        </div>

        <footer class="runner__status">
          <span data-status>게임 카드를 선택한 뒤 RUN을 누르세요.</span>
          <span data-controls></span>
        </footer>
      </section>
    </section>
  </main>
`;

const gameList = mustQuery<HTMLElement>('[data-game-list]');
const activeTitle = mustQuery<HTMLElement>('[data-active-title]');
const runnerTitle = mustQuery<HTMLElement>('[data-runner-title]');
const runnerGenre = mustQuery<HTMLElement>('[data-runner-genre]');
const startButton = mustQuery<HTMLButtonElement>('[data-start]');
const pauseButton = mustQuery<HTMLButtonElement>('[data-pause]');
const gameOverButton = mustQuery<HTMLButtonElement>('[data-game-over]');
const openLink = mustQuery<HTMLAnchorElement>('[data-open-link]');
const frame = mustQuery<HTMLIFrameElement>('[data-frame]');
const stage = mustQuery<HTMLElement>('[data-stage]');
const emptyState = mustQuery<HTMLElement>('[data-stage-empty]');
const pauseLabel = mustQuery<HTMLElement>('[data-pause-label]');
const pauseTitle = mustQuery<HTMLElement>('[data-pause-title]');
const statusText = mustQuery<HTMLElement>('[data-status]');
const controlsText = mustQuery<HTMLElement>('[data-controls]');

class FrameGameRuntime implements MiniGameRuntime {
  #activeGame: GameEntry | null = null;

  start(game: GameEntry): void {
    this.#activeGame = game;
    frame.src = createGameUrl(game.slug);
    frame.hidden = false;
    emptyState.hidden = true;
    this.#hideOverlay();
    this.#post('start');
  }

  pause(): void {
    if (!this.#activeGame) {
      return;
    }

    stage.dataset.mode = 'paused';
    pauseLabel.textContent = 'PAUSED';
    pauseTitle.textContent = this.#activeGame.title;
    this.#post('pause');
  }

  gameOver(): void {
    if (!this.#activeGame) {
      return;
    }

    stage.dataset.mode = 'game-over';
    pauseLabel.textContent = 'GAME OVER';
    pauseTitle.textContent = this.#activeGame.title;
    this.#post('gameOver');
  }

  resume(): void {
    if (!this.#activeGame) {
      return;
    }

    this.#hideOverlay();
    this.#post('start');
  }

  #hideOverlay(): void {
    delete stage.dataset.mode;
  }

  #post(command: 'start' | 'pause' | 'gameOver'): void {
    if (!this.#activeGame || !frame.contentWindow) {
      return;
    }

    frame.contentWindow.postMessage(createLifecycleMessage(command, this.#activeGame.slug), window.origin);
  }
}

const runtime = new FrameGameRuntime();
let selectedGame = findGameBySlug(window.location.hash.replace('#', '') || DEFAULT_GAME.slug);

renderGameList();
selectGame(selectedGame);

startButton.addEventListener('click', () => {
  runtime.start(selectedGame);
  statusText.textContent = `${selectedGame.title} 실행 중`;
});

pauseButton.addEventListener('click', () => {
  if (stage.dataset.mode === 'paused') {
    runtime.resume();
    statusText.textContent = `${selectedGame.title} 재개`;
    return;
  }

  runtime.pause();
  statusText.textContent = `${selectedGame.title} 일시정지`;
});

gameOverButton.addEventListener('click', () => {
  runtime.gameOver();
  statusText.textContent = `${selectedGame.title} 종료 상태`;
});

function renderGameList(): void {
  gameList.innerHTML = GAMES.map((game) => {
    const status = game.status === 'needs-server' ? 'SERVER' : 'READY';

    return `
      <button class="game-card" data-game="${game.slug}" type="button" style="--accent: ${game.accent};">
        <span class="game-card__visual" aria-hidden="true"></span>
        <span class="game-card__content">
          <span class="game-card__meta">${game.genre} / ${status}</span>
          <strong>${game.title}</strong>
          <span>${game.description}</span>
        </span>
      </button>
    `;
  }).join('');

  for (const button of gameList.querySelectorAll<HTMLButtonElement>('[data-game]')) {
    button.addEventListener('click', () => {
      const game = findGameBySlug(button.dataset.game ?? '');
      selectGame(game);
    });
  }
}

function selectGame(game: GameEntry): void {
  selectedGame = game;
  window.history.replaceState(null, '', `#${game.slug}`);
  activeTitle.textContent = game.title.toUpperCase();
  runnerTitle.textContent = game.title;
  runnerGenre.textContent = game.genre;
  openLink.href = createGameUrl(game.slug);
  controlsText.textContent = `Controls: ${game.controls.join(', ')}`;
  statusText.textContent =
    game.status === 'needs-server'
      ? '이 게임은 별도 서버가 필요합니다. 루트에서 pnpm run dev:quoridor-server를 함께 실행하세요.'
      : 'RUN을 누르면 선택한 게임이 실행됩니다.';

  for (const button of gameList.querySelectorAll<HTMLButtonElement>('[data-game]')) {
    button.classList.toggle('is-selected', button.dataset.game === game.slug);
  }
}

function mustQuery<TElement extends Element>(selector: string): TElement {
  const element = appRoot.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Missing UI element: ${selector}`);
  }

  return element;
}
