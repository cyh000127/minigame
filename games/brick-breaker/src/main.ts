import {
  Ball,
  Brick,
  Item,
  Paddle,
  ballMaxSpeed,
  calculateBrickScore,
  calculateClearBonus,
  calculatePaddleReflectionVelocity,
  circleAabbCollision,
  createStageBricks,
  increaseBallSpeed,
  playfieldHeight,
  playfieldWidth,
  reflectVelocity,
  shouldIncreaseSpeed,
  type ItemType
} from './engine';
import './styles.css';

type GamePhase = 'ready' | 'running' | 'game-over' | 'stage-clear';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root was not found.');
}

app.innerHTML = `
  <main class="shell">
    <header class="hud" aria-label="Game status">
      <div>
        <span>SCORE</span>
        <strong data-score>000000</strong>
      </div>
      <div>
        <span>STAGE</span>
        <strong data-stage>01</strong>
      </div>
      <div>
        <span>LIVES</span>
        <strong data-lives>3</strong>
      </div>
      <div>
        <span>COMBO</span>
        <strong data-combo>00</strong>
      </div>
    </header>
    <section class="cabinet" aria-label="Neon Brick Breaker board">
      <canvas id="game-canvas" width="${playfieldWidth}" height="${playfieldHeight}"></canvas>
      <div class="marquee" data-overlay>
        <p data-kicker>NEON BRICK BREAKER</p>
        <h1 data-title>READY</h1>
        <small data-copy>Move with mouse or touch. Click to launch.</small>
        <button type="button" data-start>START</button>
      </div>
    </section>
  </main>
`;

const canvas = queryElement<HTMLCanvasElement>('#game-canvas');
const rawGraphics = canvas.getContext('2d');

if (!rawGraphics) {
  throw new Error('2D canvas context is not available.');
}

const graphics: CanvasRenderingContext2D = rawGraphics;

const scoreElement = queryElement<HTMLElement>('[data-score]');
const stageElement = queryElement<HTMLElement>('[data-stage]');
const livesElement = queryElement<HTMLElement>('[data-lives]');
const comboElement = queryElement<HTMLElement>('[data-combo]');
const overlayElement = queryElement<HTMLElement>('[data-overlay]');
const titleElement = queryElement<HTMLElement>('[data-title]');
const copyElement = queryElement<HTMLElement>('[data-copy]');
const startButton = queryElement<HTMLButtonElement>('[data-start]');

const itemTypes: ItemType[] = ['expand', 'multi-ball', 'power-shot', 'magnet'];
const brickColors = {
  normal: ['#33f4ff', '#30f2a2'],
  solid: ['#ff2ed1', '#ffce57']
} as const;

let phase: GamePhase = 'ready';
let score = 0;
let stageIndex = 0;
let lives = 3;
let combo = 0;
let bricksBroken = 0;
let lastFrameMs = 0;
let shakeUntilMs = 0;
let audioContext: AudioContext | null = null;
let paddle = new Paddle(playfieldWidth / 2, playfieldHeight - 54);
let balls: Ball[] = [];
let bricks: Brick[] = [];
let items: Item[] = [];
let particles: Particle[] = [];

startButton.addEventListener('click', () => {
  startRound();
});

canvas.addEventListener('pointermove', (event) => {
  const position = resolveCanvasPosition(event);

  paddle.x = clamp(position.x, paddle.width / 2 + 24, playfieldWidth - paddle.width / 2 - 24);
  syncStuckBalls();
});

canvas.addEventListener('pointerdown', () => {
  launchStuckBalls();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();

    if (phase === 'running') {
      launchStuckBalls();
    } else {
      startRound();
    }
  }

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const direction = event.key === 'ArrowLeft' ? -1 : 1;

    paddle.x = clamp(paddle.x + direction * 42, paddle.width / 2 + 24, playfieldWidth - paddle.width / 2 - 24);
    syncStuckBalls();
  }
});

window.addEventListener('resize', resizeCanvas);

resizeCanvas();
resetStage();
requestAnimationFrame(tick);

function queryElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  return element;
}

function startRound() {
  unlockAudio();
  phase = 'running';
  score = 0;
  stageIndex = 0;
  lives = 3;
  combo = 0;
  bricksBroken = 0;
  particles = [];
  items = [];
  resetStage();
  updateOverlay();
}

function resetStage() {
  paddle = new Paddle(playfieldWidth / 2, playfieldHeight - 54);
  bricks = createStageBricks(stageIndex);
  balls = [createBallOnPaddle()];
  items = [];
  combo = 0;
  syncHud();
}

function createBallOnPaddle(): Ball {
  const ball = new Ball(paddle.x, paddle.y - paddle.height / 2 - 10, 0, -430, 8);

  ball.stuckToPaddle = true;
  return ball;
}

function tick(frameMs: number) {
  const deltaSeconds = Math.min(0.033, (frameMs - lastFrameMs) / 1000 || 0);

  lastFrameMs = frameMs;

  if (phase === 'running') {
    update(deltaSeconds, frameMs);
  }

  draw(frameMs);
  requestAnimationFrame(tick);
}

function update(deltaSeconds: number, nowMs: number) {
  updateBalls(deltaSeconds, nowMs);
  updateItems(deltaSeconds, nowMs);
  updateParticles(deltaSeconds);
  syncHud();
}

function updateBalls(deltaSeconds: number, nowMs: number) {
  for (const ball of [...balls]) {
    if (ball.stuckToPaddle) {
      ball.x = paddle.x;
      ball.y = paddle.y - paddle.height / 2 - ball.radius - 2;
      continue;
    }

    const steps = Math.max(1, Math.ceil((ball.speed * deltaSeconds) / (ball.radius * 0.75)));
    const stepSeconds = deltaSeconds / steps;

    for (let step = 0; step < steps; step += 1) {
      ball.move(stepSeconds);
      resolveWallCollision(ball);
      resolvePaddleCollision(ball, nowMs);
      resolveBrickCollision(ball, nowMs);

      if (ball.y - ball.radius > playfieldHeight + 24) {
        balls = balls.filter((candidate) => candidate !== ball);
        break;
      }
    }
  }

  if (balls.length === 0) {
    lives -= 1;
    combo = 0;

    if (lives <= 0) {
      phase = 'game-over';
      updateOverlay();
      playTone(88, 0.22, 'sawtooth');
      return;
    }

    balls = [createBallOnPaddle()];
  }
}

function resolveWallCollision(ball: Ball) {
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.vx = Math.abs(ball.vx);
    playTone(240, 0.035);
  } else if (ball.x + ball.radius > playfieldWidth) {
    ball.x = playfieldWidth - ball.radius;
    ball.vx = -Math.abs(ball.vx);
    playTone(240, 0.035);
  }

  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.vy = Math.abs(ball.vy);
    playTone(260, 0.035);
  }
}

function resolvePaddleCollision(ball: Ball, nowMs: number) {
  if (ball.vy < 0) {
    return;
  }

  const collision = circleAabbCollision(ball, paddle.rect);

  if (!collision.hit) {
    return;
  }

  if (paddle.hasMagnet(nowMs)) {
    ball.stuckToPaddle = true;
    syncStuckBalls();
    return;
  }

  const velocity = calculatePaddleReflectionVelocity(ball, paddle);

  ball.x += collision.normal.x * collision.penetration;
  ball.y = paddle.rect.y - ball.radius - 1;
  ball.setVelocity(velocity.x, velocity.y);
  combo = 0;
  shakeUntilMs = nowMs + 120;
  playTone(440, 0.05, 'triangle');
}

function resolveBrickCollision(ball: Ball, nowMs: number) {
  const powerShot = ball.powerShotUntilMs > nowMs;

  for (const brick of bricks) {
    if (brick.destroyed) {
      continue;
    }

    const collision = circleAabbCollision(ball, brick.rect);

    if (!collision.hit) {
      continue;
    }

    const destroyed = brick.hit(powerShot);

    if (!powerShot) {
      const reflected = reflectVelocity({ x: ball.vx, y: ball.vy }, collision.normal);

      ball.x += collision.normal.x * collision.penetration;
      ball.y += collision.normal.y * collision.penetration;
      ball.setVelocity(reflected.x, reflected.y);
    }

    if (destroyed) {
      combo += 1;
      bricksBroken += 1;
      score += calculateBrickScore(brick.baseScore, combo);
      spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.kind === 'solid' ? '#ff2ed1' : '#33f4ff');
      maybeDropItem(brick, nowMs);

      if (shouldIncreaseSpeed(bricksBroken)) {
        balls.forEach(increaseBallSpeed);
      }
    } else {
      spawnParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, '#ffce57', 8);
    }

    playTone(destroyed ? 640 : 520, 0.045);
    bricks = bricks.filter((candidate) => !candidate.destroyed);

    if (bricks.length === 0) {
      clearStage(nowMs);
    }

    return;
  }
}

function clearStage(nowMs: number) {
  score += calculateClearBonus(lives);
  phase = 'stage-clear';
  updateOverlay();
  playTone(880, 0.18, 'triangle');

  window.setTimeout(() => {
    if (phase !== 'stage-clear') {
      return;
    }

    stageIndex += 1;
    phase = 'running';
    resetStage();
    balls.forEach((ball) => {
      ball.setSpeed(Math.min(ballMaxSpeed, 430 + stageIndex * 34));
      ball.powerShotUntilMs = nowMs;
    });
    updateOverlay();
  }, 900);
}

function maybeDropItem(brick: Brick, nowMs: number) {
  if (Math.random() >= 0.15) {
    return;
  }

  const type = itemTypes[Math.floor(Math.random() * itemTypes.length)]!;
  const item = new Item(type, brick.x + brick.width / 2, brick.y + brick.height / 2);

  item.vy = 130 + Math.min(90, stageIndex * 10);
  items.push(item);

  if (type === 'power-shot') {
    spawnParticles(item.x, item.y, '#ff2ed1', 16);
  } else if (type === 'multi-ball') {
    spawnParticles(item.x, item.y, '#30f2a2', 16);
  } else if (type === 'magnet') {
    spawnParticles(item.x, item.y, '#33f4ff', 16);
  } else {
    spawnParticles(item.x, item.y, '#ffce57', 16);
  }

  if (nowMs < 0) {
    items.pop();
  }
}

function updateItems(deltaSeconds: number, nowMs: number) {
  for (const item of items) {
    item.move(deltaSeconds);

    if (rectIntersectsCircle(paddle.rect, item.x, item.y, item.radius)) {
      applyItem(item.type, nowMs);
      item.y = playfieldHeight + 100;
    }
  }

  items = items.filter((item) => item.y < playfieldHeight + 32);
}

function applyItem(type: ItemType, nowMs: number) {
  if (type === 'expand') {
    paddle.applyExpand(nowMs);
    playTone(350, 0.12, 'triangle');
  } else if (type === 'multi-ball') {
    const seedBall = balls.find((ball) => !ball.stuckToPaddle) ?? balls[0] ?? createBallOnPaddle();
    const baseAngle = Math.atan2(seedBall.vy, seedBall.vx);

    balls.push(seedBall.cloneWithAngle(baseAngle - 0.38), seedBall.cloneWithAngle(baseAngle + 0.38));
    playTone(720, 0.12, 'triangle');
  } else if (type === 'power-shot') {
    balls.forEach((ball) => {
      ball.powerShotUntilMs = nowMs + 5_000;
    });
    playTone(900, 0.12, 'sawtooth');
  } else if (type === 'magnet') {
    paddle.applyMagnet(nowMs);
    playTone(280, 0.12, 'sine');
  }
}

function launchStuckBalls() {
  for (const ball of balls) {
    if (!ball.stuckToPaddle) {
      continue;
    }

    ball.stuckToPaddle = false;
    ball.setVelocity((Math.random() - 0.5) * 140, -430);
  }

  if (phase === 'ready') {
    phase = 'running';
    updateOverlay();
  }
}

function syncStuckBalls() {
  for (const ball of balls) {
    if (ball.stuckToPaddle) {
      ball.x = paddle.x;
      ball.y = paddle.y - paddle.height / 2 - ball.radius - 2;
    }
  }
}

function spawnParticles(x: number, y: number, color: string, count = 18) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 220;

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + Math.random() * 0.28,
      color
    });
  }
}

function updateParticles(deltaSeconds: number) {
  particles = particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx * deltaSeconds,
      y: particle.y + particle.vy * deltaSeconds,
      vy: particle.vy + 180 * deltaSeconds,
      life: particle.life - deltaSeconds
    }))
    .filter((particle) => particle.life > 0);
}

function draw(nowMs: number) {
  const shake = nowMs < shakeUntilMs ? Math.sin(nowMs * 0.6) * 4 : 0;

  graphics.save();
  graphics.clearRect(0, 0, playfieldWidth, playfieldHeight);
  graphics.translate(shake, 0);
  drawBoard();
  drawBricks();
  drawItems();
  drawPaddle(nowMs);
  drawBalls(nowMs);
  drawParticles();
  graphics.restore();
}

function drawBoard() {
  const gradient = graphics.createLinearGradient(0, 0, 0, playfieldHeight);

  gradient.addColorStop(0, '#090a18');
  gradient.addColorStop(1, '#11143a');
  graphics.fillStyle = gradient;
  graphics.fillRect(0, 0, playfieldWidth, playfieldHeight);
  graphics.strokeStyle = 'rgba(51,244,255,0.48)';
  graphics.lineWidth = 3;
  graphics.strokeRect(28, 28, playfieldWidth - 56, playfieldHeight - 56);

  graphics.strokeStyle = 'rgba(255,46,209,0.14)';
  graphics.lineWidth = 1;

  for (let x = 68; x < playfieldWidth; x += 80) {
    graphics.beginPath();
    graphics.moveTo(x, 34);
    graphics.lineTo(x, playfieldHeight - 34);
    graphics.stroke();
  }
}

function drawBricks() {
  for (const brick of bricks) {
    const colors = brick.kind === 'solid' ? brickColors.solid : brickColors.normal;
    const ratio = brick.hitsRemaining / brick.maxHits;

    graphics.shadowColor = colors[0];
    graphics.shadowBlur = 14;
    graphics.fillStyle = colors[0];
    graphics.fillRect(brick.x, brick.y, brick.width, brick.height);
    graphics.fillStyle = colors[1];
    graphics.fillRect(brick.x + 5, brick.y + 5, (brick.width - 10) * ratio, 4);
    graphics.shadowBlur = 0;
    graphics.strokeStyle = 'rgba(248,247,255,0.68)';
    graphics.lineWidth = 1;
    graphics.strokeRect(brick.x + 0.5, brick.y + 0.5, brick.width - 1, brick.height - 1);
  }
}

function drawPaddle(nowMs: number) {
  const rect = paddle.rect;
  const hasMagnet = paddle.hasMagnet(nowMs);

  graphics.shadowColor = hasMagnet ? '#33f4ff' : '#ff2ed1';
  graphics.shadowBlur = 18;
  graphics.fillStyle = hasMagnet ? '#33f4ff' : '#f8f7ff';
  graphics.fillRect(rect.x, rect.y, rect.width, rect.height);
  graphics.fillStyle = hasMagnet ? '#151a3d' : '#ff2ed1';
  graphics.fillRect(rect.x + 8, rect.y + 4, rect.width - 16, 4);
  graphics.shadowBlur = 0;
}

function drawBalls(nowMs: number) {
  for (const ball of balls) {
    const powerShot = ball.powerShotUntilMs > nowMs;

    graphics.beginPath();
    graphics.shadowColor = powerShot ? '#ff2ed1' : '#33f4ff';
    graphics.shadowBlur = powerShot ? 24 : 14;
    graphics.fillStyle = powerShot ? '#ffce57' : '#f8f7ff';
    graphics.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    graphics.fill();
    graphics.shadowBlur = 0;
  }
}

function drawItems() {
  for (const item of items) {
    const color = resolveItemColor(item.type);

    graphics.beginPath();
    graphics.shadowColor = color;
    graphics.shadowBlur = 14;
    graphics.fillStyle = color;
    graphics.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
    graphics.fill();
    graphics.shadowBlur = 0;
    graphics.fillStyle = '#070813';
    graphics.font = '900 10px Inter, sans-serif';
    graphics.textAlign = 'center';
    graphics.textBaseline = 'middle';
    graphics.fillText(resolveItemLabel(item.type), item.x, item.y + 0.5);
  }
}

function drawParticles() {
  for (const particle of particles) {
    graphics.globalAlpha = Math.max(0, particle.life / 0.6);
    graphics.fillStyle = particle.color;
    graphics.fillRect(particle.x, particle.y, 3, 3);
  }

  graphics.globalAlpha = 1;
}

function syncHud() {
  scoreElement.textContent = score.toString().padStart(6, '0');
  stageElement.textContent = (stageIndex + 1).toString().padStart(2, '0');
  livesElement.textContent = lives.toString();
  comboElement.textContent = combo.toString().padStart(2, '0');
}

function updateOverlay() {
  overlayElement.hidden = phase === 'running';

  if (phase === 'ready') {
    titleElement.textContent = 'READY';
    copyElement.textContent = 'Move with mouse or touch. Click to launch.';
    startButton.textContent = 'START';
  } else if (phase === 'stage-clear') {
    titleElement.textContent = 'CLEAR';
    copyElement.textContent = `Life bonus +${calculateClearBonus(lives)}`;
    startButton.textContent = 'NEXT';
  } else if (phase === 'game-over') {
    titleElement.textContent = 'GAME OVER';
    copyElement.textContent = `Final score ${score.toString().padStart(6, '0')}`;
    startButton.textContent = 'RETRY';
  }
}

function resizeCanvas() {
  const pixelRatio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const nextWidth = Math.max(320, Math.floor(rect.width * pixelRatio));
  const nextHeight = Math.max(420, Math.floor(rect.height * pixelRatio));

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = playfieldWidth;
    canvas.height = playfieldHeight;
  }
}

function resolveCanvasPosition(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * playfieldWidth,
    y: ((event.clientY - rect.top) / rect.height) * playfieldHeight
  };
}

function rectIntersectsCircle(rect: { x: number; y: number; width: number; height: number }, x: number, y: number, radius: number) {
  const closestX = clamp(x, rect.x, rect.x + rect.width);
  const closestY = clamp(y, rect.y, rect.y + rect.height);
  const dx = x - closestX;
  const dy = y - closestY;

  return dx * dx + dy * dy <= radius * radius;
}

function resolveItemColor(type: ItemType): string {
  if (type === 'expand') {
    return '#ffce57';
  }

  if (type === 'multi-ball') {
    return '#30f2a2';
  }

  if (type === 'power-shot') {
    return '#ff2ed1';
  }

  return '#33f4ff';
}

function resolveItemLabel(type: ItemType): string {
  if (type === 'expand') {
    return 'EX';
  }

  if (type === 'multi-ball') {
    return 'MB';
  }

  if (type === 'power-shot') {
    return 'PS';
  }

  return 'MG';
}

function unlockAudio() {
  audioContext ??= new AudioContext();

  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
}

function playTone(frequency: number, durationSeconds: number, type: OscillatorType = 'square') {
  if (!audioContext) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.045, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + durationSeconds);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
