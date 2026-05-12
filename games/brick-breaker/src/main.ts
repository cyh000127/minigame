import './styles.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="shell">
    <header class="hud" aria-label="Game status">
      <div>
        <span>SCORE</span>
        <strong>000000</strong>
      </div>
      <div>
        <span>STAGE</span>
        <strong>01</strong>
      </div>
      <div>
        <span>LIVES</span>
        <strong>3</strong>
      </div>
    </header>
    <section class="cabinet" aria-label="Neon Brick Breaker board">
      <canvas id="game-canvas" width="960" height="640"></canvas>
      <div class="marquee">
        <p>NEON BRICK BREAKER</p>
        <h1>READY</h1>
        <button type="button" data-start>START</button>
      </div>
    </section>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const startButton = document.querySelector<HTMLButtonElement>('[data-start]');

if (!canvas || !startButton) {
  throw new Error('Game canvas was not initialized.');
}

const context = canvas.getContext('2d');

if (!context) {
  throw new Error('2D canvas context is not available.');
}

const gameCanvas = canvas;
const graphics = context;

function renderPreview() {
  const width = gameCanvas.width;
  const height = gameCanvas.height;

  graphics.clearRect(0, 0, width, height);
  graphics.fillStyle = '#090a18';
  graphics.fillRect(0, 0, width, height);
  graphics.strokeStyle = '#33f4ff';
  graphics.lineWidth = 3;
  graphics.strokeRect(36, 36, width - 72, height - 72);

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      const x = 88 + col * 80;
      const y = 84 + row * 34;

      graphics.fillStyle = row % 2 === 0 ? '#ff2ed1' : '#30f2a2';
      graphics.shadowColor = graphics.fillStyle;
      graphics.shadowBlur = 14;
      graphics.fillRect(x, y, 64, 20);
    }
  }

  graphics.shadowBlur = 0;
  graphics.fillStyle = '#f8f7ff';
  graphics.fillRect(width / 2 - 62, height - 92, 124, 14);
  graphics.beginPath();
  graphics.arc(width / 2, height - 124, 10, 0, Math.PI * 2);
  graphics.fill();
}

startButton.addEventListener('click', () => {
  renderPreview();
});

renderPreview();
