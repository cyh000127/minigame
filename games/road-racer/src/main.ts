import {
  laneCount,
  movePlayer,
  playerRow,
  roadRows,
  startGame,
  updateGame,
  type Direction,
  type RoadRacerState
} from './game';
import {
  createLeaderboardEntry,
  insertLeaderboardEntry,
  isLeaderboardScore,
  loadLeaderboard,
  normalizeInitials,
  saveLeaderboard,
  type LeaderboardEntry
} from './leaderboard';
import playerCarUrl from './assets/kenney-racing-pack/car-player-blue.png';
import obstacleConeUrl from './assets/kenney-racing-pack/obstacle-cone.png';
import trafficCarRedUrl from './assets/kenney-racing-pack/car-traffic-red.png';
import trafficCarYellowUrl from './assets/kenney-racing-pack/car-traffic-yellow.png';
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

let state: RoadRacerState = {
  ...startGame(),
  phase: 'ready'
};
let leaderboard: LeaderboardEntry[] = loadLeaderboard(window.localStorage);
let roundRecorded = false;
let lastFrameTime = 0;
const trafficCarUrls = [trafficCarRedUrl, trafficCarYellowUrl];

app.innerHTML = `
  <main class="game-shell">
    <header class="scoreboard" aria-label="Game status">
      <div>
        <span class="label">SCORE</span>
        <strong data-score>000000</strong>
      </div>
      <div>
        <span class="label">SPEED</span>
        <strong data-speed>01</strong>
      </div>
      <div>
        <span class="label">NEAR</span>
        <strong data-near>00</strong>
      </div>
      <div>
        <span class="label">BEST</span>
        <strong data-best>000000</strong>
      </div>
    </header>
    <section class="cabinet" aria-label="Road Racer">
      <div class="road" data-road></div>
      <div class="screen-message" data-message>
        <p class="kicker">ROAD RACER</p>
        <h1>READY</h1>
        <form class="initials-form" data-initials-form hidden>
          <label for="initials">NAME</label>
          <input id="initials" data-initials maxlength="3" autocomplete="off" spellcheck="false" />
          <button type="submit" data-register disabled>REGISTER</button>
        </form>
        <p class="save-state" data-save-state></p>
        <button type="button" data-start>START</button>
      </div>
    </section>
    <section class="rank-panel" aria-label="Leaderboard">
      <div class="rank-panel__header">
        <span class="label">RANK</span>
        <strong>TOP 10</strong>
      </div>
      <ol class="rank-list" data-leaderboard></ol>
    </section>
  </main>
`;

const scoreElement = queryElement<HTMLElement>('[data-score]');
const speedElement = queryElement<HTMLElement>('[data-speed]');
const nearElement = queryElement<HTMLElement>('[data-near]');
const bestElement = queryElement<HTMLElement>('[data-best]');
const roadElement = queryElement<HTMLElement>('[data-road]');
const messageElement = queryElement<HTMLElement>('[data-message]');
const startButton = queryElement<HTMLButtonElement>('[data-start]');
const initialsForm = queryElement<HTMLFormElement>('[data-initials-form]');
const initialsInput = queryElement<HTMLInputElement>('[data-initials]');
const registerButton = queryElement<HTMLButtonElement>('[data-register]');
const saveStateElement = queryElement<HTMLElement>('[data-save-state]');
const leaderboardElement = queryElement<HTMLOListElement>('[data-leaderboard]');

startButton.addEventListener('click', () => {
  beginRound();
});

initialsInput.addEventListener('input', () => {
  initialsInput.value = normalizeInitials(initialsInput.value);
  registerButton.disabled = initialsInput.value.length !== 3;
});

initialsForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const initials = normalizeInitials(initialsInput.value);

  if (initials.length !== 3 || state.phase !== 'game-over' || roundRecorded) {
    return;
  }

  leaderboard = insertLeaderboardEntry(leaderboard, createLeaderboardEntry(initials, state.score));
  leaderboard = saveLeaderboard(window.localStorage, leaderboard);
  roundRecorded = true;
  render();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const direction: Direction = event.key === 'ArrowLeft' ? 'left' : 'right';
    state = movePlayer(state, direction);
    render();
    return;
  }

  if (event.key === 'Enter' && !canRegisterCurrentScore()) {
    event.preventDefault();
    beginRound();
  }
});

requestAnimationFrame(tick);
render();

function queryElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  return element;
}

function beginRound() {
  state = startGame();
  roundRecorded = false;
  initialsInput.value = '';
  registerButton.disabled = true;
  lastFrameTime = performance.now();
  render();
}

function tick(frameTime: number) {
  if (state.phase === 'running') {
    const deltaMs = lastFrameTime === 0 ? 0 : frameTime - lastFrameTime;

    state = updateGame(state, deltaMs);
    render();
  }

  lastFrameTime = frameTime;
  requestAnimationFrame(tick);
}

function render() {
  scoreElement.textContent = state.score.toString().padStart(6, '0');
  speedElement.textContent = state.speedLevel.toString().padStart(2, '0');
  nearElement.textContent = state.nearMissCount.toString().padStart(2, '0');
  bestElement.textContent = (leaderboard[0]?.score ?? 0).toString().padStart(6, '0');
  roadElement.dataset.mode = state.roadMode;
  roadElement.replaceChildren(...createRoadCells(state));
  leaderboardElement.replaceChildren(...createLeaderboardRows(leaderboard));
  renderMessage();
}

function createRoadCells(currentState: RoadRacerState): HTMLElement[] {
  const cells: HTMLElement[] = [];

  for (let row = 0; row < roadRows; row += 1) {
    for (let lane = 0; lane < laneCount; lane += 1) {
      const cell = document.createElement('div');
      const object = currentState.objects.find((candidate) => candidate.row === row && candidate.lane === lane);
      const crashedCell =
        object != null &&
        currentState.phase === 'game-over' &&
        currentState.crashedObjectId === object.id &&
        row === playerRow &&
        lane === currentState.playerLane;

      cell.className = [
        'road-cell',
        row === playerRow ? 'road-cell--player-row' : '',
        object?.nearMissAwarded ? 'road-cell--near-miss' : '',
        crashedCell ? 'road-cell--crash' : ''
      ]
        .filter(Boolean)
        .join(' ');
      cell.dataset.row = String(row);
      cell.dataset.lane = String(lane);

      if (object) {
        const objectElement = document.createElement('img');

        objectElement.className = [
          'road-object',
          `road-object--${object.kind}`,
          currentState.crashedObjectId === object.id ? 'road-object--crashed' : ''
        ]
          .filter(Boolean)
          .join(' ');
        objectElement.src =
          object.kind === 'car' ? trafficCarUrls[object.id % trafficCarUrls.length]! : obstacleConeUrl;
        objectElement.alt = object.kind === 'car' ? 'Oncoming vehicle' : 'Traffic cone obstacle';
        cell.append(objectElement);
      }

      if (row === playerRow && lane === currentState.playerLane) {
        const player = document.createElement('img');

        player.className = currentState.phase === 'game-over' ? 'player-car player-car--crashed' : 'player-car';
        player.src = playerCarUrl;
        player.alt = 'Player car';
        cell.append(player);
      }

      cells.push(cell);
    }
  }

  return cells;
}

function createLeaderboardRows(entries: LeaderboardEntry[]): HTMLElement[] {
  return Array.from({ length: 10 }, (_, index) => {
    const entry = entries[index];
    const row = document.createElement('li');

    row.innerHTML = `
      <span>${(index + 1).toString().padStart(2, '0')}</span>
      <strong>${entry?.initials ?? '---'}</strong>
      <span>${(entry?.score ?? 0).toString().padStart(6, '0')}</span>
    `;

    return row;
  });
}

function renderMessage() {
  const heading = messageElement.querySelector<HTMLHeadingElement>('h1');

  if (!heading) {
    return;
  }

  const canRegister = canRegisterCurrentScore();

  messageElement.hidden = state.phase === 'running';
  initialsForm.hidden = !canRegister;
  saveStateElement.textContent = roundRecorded ? 'SAVED' : '';
  heading.textContent = state.phase === 'game-over' ? 'CRASH' : 'READY';
  startButton.textContent = state.phase === 'game-over' ? 'RESTART' : 'START';
}

function canRegisterCurrentScore(): boolean {
  return state.phase === 'game-over' && !roundRecorded && isLeaderboardScore(leaderboard, state.score);
}
