import './styles.css';
import {
  createGameUrl,
  createLifecycleMessage,
  DEFAULT_GAME,
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
  <main class="hub-shell" data-hub-shell data-view="library">
    <header class="topbar">
      <div>
        <p>MINIGAME HEAVEN</p>
        <h1>게임 실행기</h1>
      </div>
      <div class="topbar__meta">
        <span>${GAMES.length.toString().padStart(2, '0')} GAMES</span>
        <strong data-active-title>GAME LIST</strong>
      </div>
    </header>

    <section class="library-view" data-library-view aria-label="Game library">
      <div class="library__head">
        <div class="library__title">
          <span>GAME LIBRARY</span>
          <strong>게임 목록</strong>
        </div>
        <div class="library__stats" aria-label="Local library summary">
          <span>
            <small>LOCAL PLAYS</small>
            <strong data-library-plays>0</strong>
          </span>
          <span>
            <small>BEST SCORE</small>
            <strong data-library-best>0</strong>
          </span>
          <span>
            <small>ACHIEVEMENTS</small>
            <strong data-library-achievements>0/0</strong>
          </span>
        </div>
      </div>
      <div class="game-list game-list--library" data-game-list></div>
    </section>

    <section class="hub-layout play-view" data-play-view aria-label="Minigame launcher" hidden>
      <aside class="selector play-sidebar" aria-label="Local progress dashboard">
        <div class="selector__head">
          <span>LOCAL DASHBOARD</span>
          <strong data-selected-count>${GAMES.length}</strong>
        </div>
        <section class="progress-panel progress-panel--expanded" aria-label="Local progress dashboard">
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
        <button class="back-to-library" data-back-to-library type="button">게임 선택화면으로 돌아가기</button>
      </aside>

      <section class="game-host" aria-label="Game screen">
        <iframe data-frame title="Selected minigame" loading="eager"></iframe>
      </section>
    </section>
  </main>
`;

const hubShell = mustQuery<HTMLElement>('[data-hub-shell]');
const libraryView = mustQuery<HTMLElement>('[data-library-view]');
const playView = mustQuery<HTMLElement>('[data-play-view]');
const gameList = mustQuery<HTMLElement>('[data-game-list]');
const activeTitle = mustQuery<HTMLElement>('[data-active-title]');
const frame = mustQuery<HTMLIFrameElement>('[data-frame]');
const libraryPlaysText = mustQuery<HTMLElement>('[data-library-plays]');
const libraryBestText = mustQuery<HTMLElement>('[data-library-best]');
const libraryAchievementsText = mustQuery<HTMLElement>('[data-library-achievements]');
const progressSummary = mustQuery<HTMLElement>('[data-progress-summary]');
const totalPlaysText = mustQuery<HTMLElement>('[data-total-plays]');
const totalBestText = mustQuery<HTMLElement>('[data-total-best]');
const achievementCountText = mustQuery<HTMLElement>('[data-achievement-count]');
const selectedRecordName = mustQuery<HTMLElement>('[data-selected-record-name]');
const selectedBestText = mustQuery<HTMLElement>('[data-selected-best]');
const selectedPlaysText = mustQuery<HTMLElement>('[data-selected-plays]');
const achievementsList = mustQuery<HTMLElement>('[data-achievements]');
const resetProgressButton = mustQuery<HTMLButtonElement>('[data-reset-progress]');
const backToLibraryButton = mustQuery<HTMLButtonElement>('[data-back-to-library]');

interface ActiveHubSession {
  slug: string;
  startedAtMs: number;
  score: number | null;
}

type HubRoute = { view: 'library' } | { view: 'runner'; game: GameEntry };

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

    if (currentGameUrl === gameUrl) {
      this.#post('start');
      return;
    }

    frame.src = gameUrl;
  }

  pause(): void {
    this.#post('pause');
  }

  gameOver(): void {
    this.#post('gameOver');
  }

  resume(): void {
    this.#post('start');
  }

  clear(): void {
    this.#activeGame = null;
    frame.removeAttribute('src');
  }

  #post(command: 'start' | 'pause' | 'gameOver'): void {
    if (!this.#activeGame || !frame.contentWindow) {
      return;
    }

    frame.contentWindow.postMessage(createLifecycleMessage(command, this.#activeGame.slug), window.origin);
  }
}

const runtime = new FrameGameRuntime();
let selectedGame = DEFAULT_GAME;
let hubProgress = readHubProgress(window.localStorage);
let activeSession: ActiveHubSession | null = null;

const numberFormat = new Intl.NumberFormat('ko-KR');

renderGameList();
syncRouteFromHash();

window.addEventListener('hashchange', syncRouteFromHash);

resetProgressButton.addEventListener('click', () => {
  if (!window.confirm('로컬 기록과 업적을 초기화할까요?')) {
    return;
  }

  activeSession = null;
  hubProgress = resetHubProgress(window.localStorage);
  renderProgressViews();
});

backToLibraryButton.addEventListener('click', () => {
  goToLibrary();
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
      <button class="game-card library-card" data-game="${game.slug}" type="button" style="--accent: ${game.accent};">
        <span class="game-card__visual" aria-hidden="true"></span>
        <span class="game-card__content">
          <span class="game-card__meta">${game.genre} / ${status}</span>
          <strong>${game.title}</strong>
          <span class="game-card__description">${game.description}</span>
          <span class="game-card__record">BEST ${formatNumber(record.bestScore)} / RUN ${formatNumber(record.plays)}</span>
          <span class="game-card__cta">진입</span>
        </span>
      </button>
    `;
  }).join('');

  for (const button of gameList.querySelectorAll<HTMLButtonElement>('[data-game]')) {
    button.addEventListener('click', () => {
      const game = getRegisteredGame(button.dataset.game) ?? DEFAULT_GAME;
      goToGame(game);
    });
  }

  markSelectedGame();
}

function syncRouteFromHash(): void {
  const route = parseRoute(window.location.hash);

  if (route.view === 'runner') {
    showRunnerView(route.game);
    return;
  }

  showLibraryView();
}

function parseRoute(hash: string): HubRoute {
  const route = decodeURIComponent(hash.replace(/^#/, '')).trim();

  if (!route || route === 'library' || route === 'games') {
    return { view: 'library' };
  }

  const slug = route.startsWith('game/') ? route.slice('game/'.length) : route;
  const game = getRegisteredGame(slug);

  return game ? { view: 'runner', game } : { view: 'library' };
}

function goToGame(game: GameEntry): void {
  const nextHash = `#game/${game.slug}`;

  if (window.location.hash === nextHash) {
    showRunnerView(game);
    return;
  }

  window.location.hash = nextHash;
}

function goToLibrary(): void {
  if (!window.location.hash || window.location.hash === '#library') {
    showLibraryView();
    return;
  }

  window.location.hash = 'library';
}

function showLibraryView(): void {
  if (activeSession) {
    finishLocalSession({ completed: false });
  }

  runtime.pause();
  runtime.clear();
  hubShell.dataset.view = 'library';
  libraryView.hidden = false;
  playView.hidden = true;
  activeTitle.textContent = 'GAME LIST';
  renderProgressViews();
}

function showRunnerView(game: GameEntry): void {
  hubShell.dataset.view = 'runner';
  libraryView.hidden = true;
  playView.hidden = false;
  updateSelectedGame(game);
  beginLocalSession(game);
  runtime.start(game);
}

function updateSelectedGame(game: GameEntry): void {
  selectedGame = game;
  activeTitle.textContent = game.title.toUpperCase();

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

  libraryPlaysText.textContent = formatNumber(summary.totalPlays);
  libraryBestText.textContent = formatNumber(summary.totalBestScore);
  libraryAchievementsText.textContent = `${summary.unlockedAchievementCount}/${summary.achievementCount}`;
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
