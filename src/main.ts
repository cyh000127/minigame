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
import {
  ACHIEVEMENTS,
  getGameProgress,
  readHubProgress,
  recordGameEnd,
  recordGameStart,
  resetHubProgress,
  summarizeHubProgress,
  writeHubProgress,
} from './local-progress';

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
        <section class="progress-panel" aria-label="Local progress dashboard">
          <div class="progress-panel__head">
            <span>LOCAL RECORD</span>
            <strong data-progress-summary>0/0</strong>
          </div>
          <div class="progress-stats" aria-label="Hub progress summary">
            <span>
              <small>PLAYS</small>
              <strong data-total-plays>0</strong>
            </span>
            <span>
              <small>BEST</small>
              <strong data-total-best>0</strong>
            </span>
            <span>
              <small>ACHV</small>
              <strong data-achievement-count>0/0</strong>
            </span>
          </div>
          <div class="selected-record" aria-live="polite">
            <small data-selected-record-name>SELECTED</small>
            <strong data-selected-best>BEST 0</strong>
            <span data-selected-plays>0 RUNS / 0:00</span>
          </div>
          <div class="achievement-track" data-achievements></div>
          <button class="reset-progress" data-reset-progress type="button">RESET LOCAL</button>
        </section>
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
const progressSummary = mustQuery<HTMLElement>('[data-progress-summary]');
const totalPlaysText = mustQuery<HTMLElement>('[data-total-plays]');
const totalBestText = mustQuery<HTMLElement>('[data-total-best]');
const achievementCountText = mustQuery<HTMLElement>('[data-achievement-count]');
const selectedRecordName = mustQuery<HTMLElement>('[data-selected-record-name]');
const selectedBestText = mustQuery<HTMLElement>('[data-selected-best]');
const selectedPlaysText = mustQuery<HTMLElement>('[data-selected-plays]');
const achievementsList = mustQuery<HTMLElement>('[data-achievements]');
const resetProgressButton = mustQuery<HTMLButtonElement>('[data-reset-progress]');

interface ActiveHubSession {
  slug: string;
  startedAtMs: number;
  score: number | null;
}

class FrameGameRuntime implements MiniGameRuntime {
  #activeGame: GameEntry | null = null;

  constructor() {
    frame.addEventListener('load', () => {
      if (!this.#activeGame) {
        return;
      }

      this.#post('start');
    });
  }

  start(game: GameEntry): void {
    this.#activeGame = game;
    const gameUrl = createGameUrl(game.slug);
    const currentGameUrl = frame.getAttribute('src');

    frame.hidden = false;
    emptyState.hidden = true;
    this.#hideOverlay();

    if (currentGameUrl === gameUrl) {
      this.#post('start');
      return;
    }

    frame.src = gameUrl;
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
let hubProgress = readHubProgress(window.localStorage);
let activeSession: ActiveHubSession | null = null;

const numberFormat = new Intl.NumberFormat('ko-KR');

renderGameList();
selectGame(selectedGame);

startButton.addEventListener('click', () => {
  beginLocalSession(selectedGame);
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
  finishLocalSession({ completed: true });
  statusText.textContent = `${selectedGame.title} 종료 상태`;
});

resetProgressButton.addEventListener('click', () => {
  if (!window.confirm('로컬 기록과 업적을 초기화할까요?')) {
    return;
  }

  activeSession = null;
  hubProgress = resetHubProgress(window.localStorage);
  renderProgressViews();
  statusText.textContent = '로컬 기록을 초기화했습니다.';
});

window.addEventListener('message', (event) => {
  if (event.origin !== window.origin || !isRecord(event.data)) {
    return;
  }

  const type = readMessageType(event.data);

  if (!type || !isSupportedGameMessageType(type)) {
    return;
  }

  const game = getRegisteredGame(event.data.gameSlug) ?? getRegisteredGame(activeSession?.slug) ?? selectedGame;
  const score = readMessageScore(event.data);

  if (type === 'minigame:start' || type === 'start') {
    beginLocalSession(game);
    return;
  }

  if (type === 'minigame:score' || type === 'score') {
    updateActiveSessionScore(game.slug, score);
    return;
  }

  if (type === 'minigame:game-over' || type === 'game-over' || type === 'gameOver') {
    finishLocalSession({ slug: game.slug, score, completed: true });
  }
});

function renderGameList(): void {
  gameList.innerHTML = GAMES.map((game) => {
    const status = game.status === 'needs-server' ? 'SERVER' : 'READY';
    const record = getGameProgress(hubProgress, game.slug);

    return `
      <button class="game-card" data-game="${game.slug}" type="button" style="--accent: ${game.accent};">
        <span class="game-card__visual" aria-hidden="true"></span>
        <span class="game-card__content">
          <span class="game-card__meta">${game.genre} / ${status}</span>
          <strong>${game.title}</strong>
          <span>${game.description}</span>
          <span class="game-card__record">BEST ${formatNumber(record.bestScore)} / RUN ${formatNumber(record.plays)}</span>
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

  markSelectedGame();
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

  renderDashboard();
  markSelectedGame();
}

function beginLocalSession(game: GameEntry): void {
  if (activeSession?.slug === game.slug) {
    return;
  }

  if (activeSession) {
    finishLocalSession({ completed: false });
  }

  hubProgress = writeHubProgress(window.localStorage, recordGameStart(hubProgress, game.slug));
  activeSession = {
    slug: game.slug,
    startedAtMs: performance.now(),
    score: null,
  };
  renderProgressViews();
}

function updateActiveSessionScore(slug: string, score: number | undefined): void {
  if (!activeSession || activeSession.slug !== slug || score === undefined) {
    return;
  }

  activeSession = {
    ...activeSession,
    score,
  };
}

function finishLocalSession(options: { slug?: string; score?: number; completed?: boolean } = {}): void {
  if (!activeSession) {
    return;
  }

  const session = activeSession;
  const slug = options.slug ?? session.slug;
  const score = options.score ?? session.score ?? undefined;
  const durationMs = Math.max(0, Math.round(performance.now() - session.startedAtMs));

  hubProgress = writeHubProgress(
    window.localStorage,
    recordGameEnd(hubProgress, slug, {
      score,
      durationMs,
      completed: options.completed,
    }),
  );
  activeSession = null;
  renderProgressViews();
}

function renderProgressViews(): void {
  renderDashboard();
  renderGameList();
}

function renderDashboard(): void {
  const summary = summarizeHubProgress(hubProgress);
  const selectedRecord = getGameProgress(hubProgress, selectedGame.slug);

  progressSummary.textContent = `${summary.unlockedAchievementCount}/${summary.achievementCount}`;
  totalPlaysText.textContent = formatNumber(summary.totalPlays);
  totalBestText.textContent = formatNumber(summary.totalBestScore);
  achievementCountText.textContent = `${summary.unlockedAchievementCount}/${summary.achievementCount}`;
  selectedRecordName.textContent = selectedGame.title.toUpperCase();
  selectedBestText.textContent = `BEST ${formatNumber(selectedRecord.bestScore)}`;
  selectedPlaysText.textContent = `${formatNumber(selectedRecord.plays)} RUNS / ${formatDuration(
    selectedRecord.totalPlayTimeMs,
  )}`;
  achievementsList.innerHTML = ACHIEVEMENTS.map((achievement) => {
    const unlocked = hubProgress.unlockedAchievementIds.includes(achievement.id);

    return `
      <span class="achievement-item${unlocked ? ' is-unlocked' : ''}">
        <span class="achievement-item__mark" aria-hidden="true">${unlocked ? 'ON' : '--'}</span>
        <span>
          <strong>${achievement.title}</strong>
          <small>${achievement.description}</small>
        </span>
      </span>
    `;
  }).join('');
}

function markSelectedGame(): void {
  for (const button of gameList.querySelectorAll<HTMLButtonElement>('[data-game]')) {
    button.classList.toggle('is-selected', button.dataset.game === selectedGame.slug);
  }
}

function getRegisteredGame(slug: unknown): GameEntry | null {
  return typeof slug === 'string' ? GAMES.find((game) => game.slug === slug) ?? null : null;
}

function readMessageType(message: Record<string, unknown>): string | null {
  if (typeof message.type === 'string') {
    return message.type;
  }

  return typeof message.command === 'string' ? message.command : null;
}

function readMessageScore(message: Record<string, unknown>): number | undefined {
  const candidates = [message.score, message.value];

  for (const candidate of candidates) {
    const score = Number(candidate);

    if (Number.isFinite(score)) {
      return Math.max(0, Math.floor(score));
    }
  }

  return undefined;
}

function isSupportedGameMessageType(type: string): boolean {
  return [
    'minigame:start',
    'start',
    'minigame:score',
    'score',
    'minigame:game-over',
    'game-over',
    'gameOver',
  ].includes(type);
}

function formatNumber(value: number): string {
  return numberFormat.format(value);
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function mustQuery<TElement extends Element>(selector: string): TElement {
  const element = appRoot.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Missing UI element: ${selector}`);
  }

  return element;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
