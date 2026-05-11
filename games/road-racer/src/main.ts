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
import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

let state: RoadRacerState = startGame();
state = {
  ...state,
  phase: 'ready'
};
let lastFrameTime = 0;

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
        <span class="label">STATUS</span>
        <strong data-status>READY</strong>
      </div>
    </header>
    <section class="cabinet" aria-label="Road Racer">
      <div class="road" data-road></div>
      <div class="screen-message" data-message>
        <p class="kicker">ROAD RACER</p>
        <h1>READY</h1>
        <button type="button" data-start>START</button>
      </div>
    </section>
  </main>
`;

const scoreElement = queryElement<HTMLElement>('[data-score]');
const speedElement = queryElement<HTMLElement>('[data-speed]');
const statusElement = queryElement<HTMLElement>('[data-status]');
const roadElement = queryElement<HTMLElement>('[data-road]');
const messageElement = queryElement<HTMLElement>('[data-message]');
const startButton = queryElement<HTMLButtonElement>('[data-start]');

startButton.addEventListener('click', () => {
  beginRound();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const direction: Direction = event.key === 'ArrowLeft' ? 'left' : 'right';
    state = movePlayer(state, direction);
    render();
    return;
  }

  if (event.key === 'Enter') {
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
  statusElement.textContent = state.phase === 'game-over' ? 'CRASH' : state.phase.toUpperCase();
  roadElement.replaceChildren(...createRoadCells(state));
  renderMessage();
}

function createRoadCells(currentState: RoadRacerState): HTMLElement[] {
  const cells: HTMLElement[] = [];

  for (let row = 0; row < roadRows; row += 1) {
    for (let lane = 0; lane < laneCount; lane += 1) {
      const cell = document.createElement('div');
      const object = currentState.objects.find((candidate) => candidate.row === row && candidate.lane === lane);

      cell.className = 'road-cell';
      cell.dataset.row = String(row);
      cell.dataset.lane = String(lane);

      if (object) {
        const objectElement = document.createElement('span');

        objectElement.className = [
          'road-object',
          `road-object--${object.kind}`,
          currentState.crashedObjectId === object.id ? 'road-object--crashed' : ''
        ]
          .filter(Boolean)
          .join(' ');
        objectElement.textContent = object.kind === 'car' ? 'CAR' : 'XXX';
        cell.append(objectElement);
      }

      if (row === playerRow && lane === currentState.playerLane) {
        const player = document.createElement('span');

        player.className = currentState.phase === 'game-over' ? 'player-car player-car--crashed' : 'player-car';
        player.textContent = 'YOU';
        cell.append(player);
      }

      cells.push(cell);
    }
  }

  return cells;
}

function renderMessage() {
  const heading = messageElement.querySelector<HTMLHeadingElement>('h1');

  if (!heading) {
    return;
  }

  messageElement.hidden = state.phase === 'running';
  heading.textContent = state.phase === 'game-over' ? 'CRASH' : 'READY';
  startButton.textContent = state.phase === 'game-over' ? 'RESTART' : 'START';
}
