import { describe, expect, it } from 'vitest';
import {
  createGameState,
  getKeyboardDirection,
  getFoodScore,
  getSpeedLevel,
  getStepDurationMs,
  queueDirection,
  SCORE_PER_BONUS_FOOD,
  SCORE_PER_FOOD,
  spawnFood,
  startGame,
  stepGame,
  type RandomSource,
  type SnakeState,
} from './game';

function sequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;

  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

describe('Snake engine', () => {
  it('creates a ready snake with food outside the snake body', () => {
    const state = createGameState(sequenceRandom([0]));

    expect(state.phase).toBe('ready');
    expect(state.snake).toHaveLength(3);
    expect(state.obstacles).toHaveLength(0);
    expect(state.snake.some((part) => part.row === state.food.row && part.column === state.food.column))
      .toBe(false);
  });

  it('starts and moves the snake forward', () => {
    const state = startGame(createGameState(sequenceRandom([0.99])));
    const next = stepGame(state);

    expect(next.phase).toBe('playing');
    expect(next.snake[0]).toEqual({ row: 7, column: 9 });
    expect(next.snake).toHaveLength(3);
  });

  it('blocks immediate reverse direction', () => {
    const state = startGame(createGameState(sequenceRandom([0.99])));
    const next = queueDirection(state, 'left');

    expect(next.pendingDirection).toBe('right');
  });

  it('queues a perpendicular direction', () => {
    const state = startGame(createGameState(sequenceRandom([0.99])));
    const next = stepGame(queueDirection(state, 'up'));

    expect(next.direction).toBe('up');
    expect(next.snake[0]).toEqual({ row: 6, column: 8 });
  });

  it('grows and scores when eating food', () => {
    const state: SnakeState = {
      ...startGame(createGameState(sequenceRandom([0.99]))),
      food: { row: 7, column: 9 },
    };
    const next = stepGame(state, sequenceRandom([0]));

    expect(next.score).toBe(SCORE_PER_FOOD);
    expect(next.snake).toHaveLength(4);
    expect(next.food).not.toEqual({ row: 7, column: 9 });
  });

  it('ends when hitting a wall', () => {
    let state = startGame(createGameState(sequenceRandom([0.99])));

    for (let index = 0; index < 8; index += 1) {
      state = stepGame(state);
    }

    expect(state.phase).toBe('game-over');
  });

  it('ends when hitting itself', () => {
    const state: SnakeState = {
      gridSize: 15,
      phase: 'playing',
      snake: [
        { row: 5, column: 5 },
        { row: 5, column: 4 },
        { row: 6, column: 4 },
        { row: 6, column: 5 },
        { row: 6, column: 6 },
      ],
      direction: 'up',
      pendingDirection: 'left',
      food: { row: 0, column: 0 },
      foodKind: 'normal',
      obstacles: [],
      obstacleMode: false,
      score: 40,
      bestScore: 40,
      moveCount: 0,
    };

    expect(stepGame(state).phase).toBe('game-over');
  });

  it('spawns food on empty cells only', () => {
    const food = spawnFood(
      3,
      [
        { row: 0, column: 0 },
        { row: 0, column: 1 },
        { row: 0, column: 2 },
      ],
      sequenceRandom([0]),
    );

    expect(food).toEqual({ row: 1, column: 0 });
  });

  it('creates obstacle mode and ends when hitting an obstacle', () => {
    const state: SnakeState = {
      ...startGame(createGameState(sequenceRandom([0.99]), 0, true)),
      snake: [
        { row: 3, column: 2 },
        { row: 3, column: 1 },
        { row: 3, column: 0 },
      ],
      direction: 'right',
      pendingDirection: 'right',
      food: { row: 0, column: 0 },
      foodKind: 'normal',
      obstacles: [{ row: 3, column: 3 }],
    };

    expect(state.obstacleMode).toBe(true);
    expect(stepGame(state).phase).toBe('game-over');
  });

  it('scores bonus food with a larger value', () => {
    const state: SnakeState = {
      ...startGame(createGameState(sequenceRandom([0.99]))),
      food: { row: 7, column: 9 },
      foodKind: 'bonus',
    };
    const next = stepGame(state, sequenceRandom([0, 0.99]));

    expect(getFoodScore('bonus')).toBe(SCORE_PER_BONUS_FOOD);
    expect(next.score).toBe(SCORE_PER_BONUS_FOOD);
  });

  it('calculates speed level and step duration from score', () => {
    expect(getSpeedLevel(0)).toBe(1);
    expect(getSpeedLevel(50)).toBe(2);
    expect(getStepDurationMs(0)).toBeGreaterThan(getStepDurationMs(100));
  });

  it('maps keyboard keys to directions', () => {
    expect(getKeyboardDirection('ArrowUp')).toBe('up');
    expect(getKeyboardDirection('KeyA')).toBe('left');
    expect(getKeyboardDirection('x')).toBeNull();
  });
});
