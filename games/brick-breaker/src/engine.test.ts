import { describe, expect, it } from 'vitest';
import {
  Ball,
  Brick,
  Paddle,
  ballMaxSpeed,
  ballMinSpeed,
  calculateBrickScore,
  calculateClearBonus,
  calculatePaddleReflectionVelocity,
  circleAabbCollision,
  createRandomStageLayout,
  createStageBricks,
  increaseBallSpeed,
  isStageLayoutClearable,
  reflectVelocity,
  shouldIncreaseSpeed
} from './engine';

describe('brick breaker engine', () => {
  it('clamps ball speed between the minimum and maximum limits', () => {
    const slowBall = new Ball(0, 0, 1, 0);
    const fastBall = new Ball(0, 0, 2_000, 0);

    expect(slowBall.speed).toBe(ballMinSpeed);
    expect(fastBall.speed).toBe(ballMaxSpeed);

    increaseBallSpeed(fastBall);

    expect(fastBall.speed).toBe(ballMaxSpeed);
  });

  it('returns a near vertical bounce at paddle center and wider angles at the edges', () => {
    const paddle = new Paddle(100, 300, 100, 16);
    const centerBall = new Ball(100, 286, 0, 420);
    const edgeBall = new Ball(150, 286, 0, 420);
    const centerVelocity = calculatePaddleReflectionVelocity(centerBall, paddle);
    const edgeVelocity = calculatePaddleReflectionVelocity(edgeBall, paddle);

    expect(Math.abs(centerVelocity.x)).toBeLessThan(0.0001);
    expect(centerVelocity.y).toBeLessThan(0);
    expect(edgeVelocity.x).toBeGreaterThan(300);
    expect(edgeVelocity.y).toBeLessThan(0);
  });

  it('detects circle and AABB collision with a normal and penetration', () => {
    const ball = new Ball(50, 50, 0, -420, 10);
    const collision = circleAabbCollision(ball, {
      x: 50,
      y: 58,
      width: 40,
      height: 20
    });

    expect(collision.hit).toBe(true);
    expect(collision.normal.y).toBeLessThan(0);
    expect(collision.penetration).toBeGreaterThan(0);
  });

  it('reflects velocity against the supplied collision normal', () => {
    const reflected = reflectVelocity({ x: 100, y: 200 }, { x: 0, y: -1 });

    expect(reflected).toEqual({ x: 100, y: -200 });
  });

  it('calculates combo and clear bonuses from the scoring rules', () => {
    expect(calculateBrickScore(100, 0)).toBe(100);
    expect(calculateBrickScore(100, 3)).toBe(400);
    expect(calculateBrickScore(250, 2)).toBe(750);
    expect(calculateClearBonus(3)).toBe(3000);
  });

  it('tracks normal and solid brick damage', () => {
    const normalBrick = new Brick({ x: 0, y: 0, width: 20, height: 10 }, 'normal');
    const solidBrick = new Brick({ x: 0, y: 0, width: 20, height: 10 }, 'solid');
    const bonusBrick = new Brick({ x: 0, y: 0, width: 20, height: 10 }, 'bonus');

    expect(normalBrick.hit()).toBe(true);
    expect(solidBrick.hit()).toBe(false);
    expect(solidBrick.hit()).toBe(true);
    expect(bonusBrick.hit()).toBe(true);
    expect(bonusBrick.baseScore).toBe(180);
  });

  it('increases speed every five broken bricks', () => {
    expect(shouldIncreaseSpeed(4)).toBe(false);
    expect(shouldIncreaseSpeed(5)).toBe(true);
    expect(shouldIncreaseSpeed(10)).toBe(true);
  });

  it('creates deterministic random stage layouts with mixed brick types', () => {
    const firstLayout = createRandomStageLayout(3, { seed: 42 });
    const secondLayout = createRandomStageLayout(3, { seed: 42 });
    const bricks = createStageBricks(0);

    expect(firstLayout).toEqual(secondLayout);
    expect(isStageLayoutClearable(firstLayout)).toBe(true);
    expect(bricks.length).toBeGreaterThan(0);
    expect(bricks.some((brick) => brick.kind === 'solid')).toBe(true);
    expect(createStageBricks(4, { seed: 99, bonusChance: 1 }).every((brick) => brick.kind === 'bonus')).toBe(true);
    expect(bricks.some((brick) => brick.kind === 'normal')).toBe(true);
  });

  it('generates only clearable maps across many seeds', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const layout = createRandomStageLayout(seed, { seed });

      expect(isStageLayoutClearable(layout)).toBe(true);
      expect(layout.join('').replace(/\./g, '').length).toBeGreaterThan(0);
    }
  });

  it('rejects maps with no breakable bricks', () => {
    expect(isStageLayoutClearable(['....', '....'])).toBe(false);
  });
});
