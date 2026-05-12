export const playfieldWidth = 960;
export const playfieldHeight = 640;
export const ballMinSpeed = 320;
export const ballMaxSpeed = 760;
export const speedIncreaseEvery = 5;
export const speedIncreaseMultiplier = 1.05;
export const maxPaddleBounceAngle = (60 * Math.PI) / 180;

export type BrickKind = 'normal' | 'solid';
export type ItemType = 'expand' | 'multi-ball' | 'power-shot' | 'magnet';

export interface Vector {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CircleCollision {
  hit: boolean;
  normal: Vector;
  penetration: number;
}

export class Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  powerShotUntilMs = 0;
  stuckToPaddle = false;

  constructor(x: number, y: number, vx = 0, vy = -420, radius = 8) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.enforceSpeedLimits();
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vy);
  }

  move(deltaSeconds: number) {
    if (this.stuckToPaddle) {
      return;
    }

    this.x += this.vx * deltaSeconds;
    this.y += this.vy * deltaSeconds;
  }

  setVelocity(vx: number, vy: number) {
    this.vx = vx;
    this.vy = vy;
    this.enforceSpeedLimits();
  }

  setSpeed(speed: number) {
    const currentSpeed = this.speed || 1;
    const nextSpeed = clamp(speed, ballMinSpeed, ballMaxSpeed);

    this.vx = (this.vx / currentSpeed) * nextSpeed;
    this.vy = (this.vy / currentSpeed) * nextSpeed;
  }

  enforceSpeedLimits() {
    const speed = this.speed;

    if (speed === 0) {
      this.vx = 0;
      this.vy = -ballMinSpeed;
      return;
    }

    if (speed < ballMinSpeed || speed > ballMaxSpeed) {
      this.setSpeed(speed);
    }
  }

  cloneWithAngle(angleRadians: number): Ball {
    const speed = this.speed;
    const clone = new Ball(this.x, this.y, Math.cos(angleRadians) * speed, Math.sin(angleRadians) * speed, this.radius);

    clone.powerShotUntilMs = this.powerShotUntilMs;
    return clone;
  }
}

export class Paddle {
  x: number;
  y: number;
  baseWidth: number;
  height: number;
  expandUntilMs = 0;
  magnetUntilMs = 0;

  constructor(x: number, y: number, baseWidth = 132, height = 16) {
    this.x = x;
    this.y = y;
    this.baseWidth = baseWidth;
    this.height = height;
  }

  get width(): number {
    return this.expandUntilMs > performanceSafeNow() ? this.baseWidth * 1.5 : this.baseWidth;
  }

  get rect(): Rect {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      width: this.width,
      height: this.height
    };
  }

  applyExpand(nowMs: number, durationMs = 10_000) {
    this.expandUntilMs = nowMs + durationMs;
  }

  applyMagnet(nowMs: number, durationMs = 10_000) {
    this.magnetUntilMs = nowMs + durationMs;
  }

  hasMagnet(nowMs: number): boolean {
    return this.magnetUntilMs > nowMs;
  }
}

export class Brick {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly kind: BrickKind;
  readonly maxHits: number;
  hitsRemaining: number;

  constructor(rect: Rect, kind: BrickKind = 'normal') {
    this.x = rect.x;
    this.y = rect.y;
    this.width = rect.width;
    this.height = rect.height;
    this.kind = kind;
    this.maxHits = kind === 'solid' ? 2 : 1;
    this.hitsRemaining = this.maxHits;
  }

  get rect(): Rect {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
    };
  }

  get destroyed(): boolean {
    return this.hitsRemaining <= 0;
  }

  get baseScore(): number {
    return this.kind === 'solid' ? 250 : 100;
  }

  hit(powerShot = false): boolean {
    this.hitsRemaining -= powerShot ? this.hitsRemaining : 1;

    return this.destroyed;
  }
}

export class Item {
  readonly type: ItemType;
  x: number;
  y: number;
  vy: number;
  radius = 12;

  constructor(type: ItemType, x: number, y: number, vy = 130) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.vy = vy;
  }

  move(deltaSeconds: number) {
    this.y += this.vy * deltaSeconds;
  }
}

export function calculatePaddleReflectionVelocity(ball: Ball, paddle: Paddle): Vector {
  const paddleRect = paddle.rect;
  const relativeHit = clamp((ball.x - (paddleRect.x + paddleRect.width / 2)) / (paddleRect.width / 2), -1, 1);
  const bounceAngle = -Math.PI / 2 + relativeHit * maxPaddleBounceAngle;
  const speed = clamp(ball.speed, ballMinSpeed, ballMaxSpeed);

  return {
    x: Math.cos(bounceAngle) * speed,
    y: Math.sin(bounceAngle) * speed
  };
}

export function circleAabbCollision(ball: Ball, rect: Rect): CircleCollision {
  const closestX = clamp(ball.x, rect.x, rect.x + rect.width);
  const closestY = clamp(ball.y, rect.y, rect.y + rect.height);
  let dx = ball.x - closestX;
  let dy = ball.y - closestY;
  const distanceSquared = dx * dx + dy * dy;

  if (distanceSquared > ball.radius * ball.radius) {
    return {
      hit: false,
      normal: { x: 0, y: 0 },
      penetration: 0
    };
  }

  if (distanceSquared === 0) {
    const left = Math.abs(ball.x - rect.x);
    const right = Math.abs(rect.x + rect.width - ball.x);
    const top = Math.abs(ball.y - rect.y);
    const bottom = Math.abs(rect.y + rect.height - ball.y);
    const minDistance = Math.min(left, right, top, bottom);

    if (minDistance === left) {
      dx = -1;
      dy = 0;
    } else if (minDistance === right) {
      dx = 1;
      dy = 0;
    } else if (minDistance === top) {
      dx = 0;
      dy = -1;
    } else {
      dx = 0;
      dy = 1;
    }

    return {
      hit: true,
      normal: normalizeVector({ x: dx, y: dy }),
      penetration: ball.radius
    };
  }

  const distance = Math.sqrt(distanceSquared);

  return {
    hit: true,
    normal: {
      x: dx / distance,
      y: dy / distance
    },
    penetration: ball.radius - distance
  };
}

export function reflectVelocity(velocity: Vector, normal: Vector): Vector {
  const normalizedNormal = normalizeVector(normal);
  const dot = velocity.x * normalizedNormal.x + velocity.y * normalizedNormal.y;

  return {
    x: velocity.x - 2 * dot * normalizedNormal.x,
    y: velocity.y - 2 * dot * normalizedNormal.y
  };
}

export function calculateBrickScore(baseScore: number, comboCount: number): number {
  const comboBonus = baseScore * Math.max(0, comboCount);

  return baseScore + comboBonus;
}

export function calculateClearBonus(livesRemaining: number): number {
  return Math.max(0, livesRemaining) * 1000;
}

export function shouldIncreaseSpeed(bricksBroken: number): boolean {
  return bricksBroken > 0 && bricksBroken % speedIncreaseEvery === 0;
}

export function increaseBallSpeed(ball: Ball) {
  ball.setSpeed(ball.speed * speedIncreaseMultiplier);
}

export function createStageBricks(stageIndex: number): Brick[] {
  const layout = stageLayouts[stageIndex % stageLayouts.length]!;
  const brickWidth = 74;
  const brickHeight = 24;
  const gap = 10;
  const startX = (playfieldWidth - layout[0]!.length * brickWidth - (layout[0]!.length - 1) * gap) / 2;
  const startY = 76;

  return layout.flatMap((row, rowIndex) =>
    [...row].flatMap((cell, colIndex) => {
      if (cell === '.') {
        return [];
      }

      return [
        new Brick(
          {
            x: startX + colIndex * (brickWidth + gap),
            y: startY + rowIndex * (brickHeight + gap),
            width: brickWidth,
            height: brickHeight
          },
          cell === '2' ? 'solid' : 'normal'
        )
      ];
    })
  );
}

export const stageLayouts = [
  [
    '1111111111',
    '1221111221',
    '1112221111',
    '1111111111',
    '..112211..'
  ],
  [
    '2222222222',
    '1..1111..1',
    '1112222111',
    '1..1111..1',
    '2222222222'
  ],
  [
    '11..22..11',
    '.11222211.',
    '1122112211',
    '.11222211.',
    '11..22..11'
  ]
] as const;

function normalizeVector(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y);

  if (length === 0) {
    return { x: 0, y: -1 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function performanceSafeNow(): number {
  return typeof performance === 'undefined' ? 0 : performance.now();
}
