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
  createStageBricks,
  increaseBallSpeed,
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

    expect(normalBrick.hit()).toBe(true);
    expect(solidBrick.hit()).toBe(false);
    expect(solidBrick.hit()).toBe(true);
  });

  it('increases speed every five broken bricks', () => {
    expect(shouldIncreaseSpeed(4)).toBe(false);
    expect(shouldIncreaseSpeed(5)).toBe(true);
    expect(shouldIncreaseSpeed(10)).toBe(true);
  });

  it('creates reusable stage layouts with mixed brick types', () => {
    const bricks = createStageBricks(0);

    expect(bricks.length).toBeGreaterThan(0);
    expect(bricks.some((brick) => brick.kind === 'solid')).toBe(true);
    expect(bricks.some((brick) => brick.kind === 'normal')).toBe(true);
  });
});
