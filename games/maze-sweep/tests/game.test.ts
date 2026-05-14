import { describe, expect, it } from 'vitest';
import {
  advanceRound,
  calculateRoundScore,
  canExit,
  countRemainingCollectibles,
  createInitialState,
  createPositionKey,
  createSeededRandom,
  getRoundTimeSeconds,
  isTimedOut,
  movePlayer,
  recordFailure,
  tickTimer,
} from '../src/game';

function findPath(
  board: ReturnType<typeof createInitialState>['board'],
  start: { row: number; col: number },
  target: { row: number; col: number },
): ('up' | 'right' | 'down' | 'left')[] {
  const queue: Array<{ row: number; col: number; path: ('up' | 'right' | 'down' | 'left')[] }> = [
    { ...start, path: [] },
  ];
  const visited = new Set<string>([createPositionKey(start)]);
  const directions = [
    { id: 'up' as const, rowDelta: -1, colDelta: 0 },
    { id: 'right' as const, rowDelta: 0, colDelta: 1 },
    { id: 'down' as const, rowDelta: 1, colDelta: 0 },
    { id: 'left' as const, rowDelta: 0, colDelta: -1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      break;
    }

    if (current.row === target.row && current.col === target.col) {
      return current.path;
    }

    for (const direction of directions) {
      const next = {
        row: current.row + direction.rowDelta,
        col: current.col + direction.colDelta,
      };
      const key = createPositionKey(next);

      if (visited.has(key) || board[next.row]?.[next.col]?.kind !== 'floor') {
        continue;
      }

      visited.add(key);
      queue.push({
        ...next,
        path: [...current.path, direction.id],
      });
    }
  }

  throw new Error('Path was not found.');
}

describe('Maze Sweep rules', () => {
  it('creates deterministic stages from the same seed', () => {
    const first = createInitialState('normal', 135);
    const second = createInitialState('normal', 135);

    expect(first.board).toEqual(second.board);
    expect(first.collectibles).toEqual(second.collectibles);
    expect(first.exit).toEqual(second.exit);
  });

  it('generates reachable collectibles and exit', () => {
    const state = createInitialState('hard', 2468);

    expect(state.collectibles).toHaveLength(state.difficulty.collectibleCount);
    expect(state.board[state.player.row]?.[state.player.col]?.kind).toBe('floor');
    expect(state.board[state.exit.row]?.[state.exit.col]?.kind).toBe('floor');
  });

  it('moves only onto floor cells and collects orbs', () => {
    const state = createInitialState('easy', 999);
    const firstCollectible = state.collectibles[0];

    expect(firstCollectible).toBeDefined();

    if (!firstCollectible) {
      return;
    }

    let nextState = state;
    for (const direction of findPath(state.board, state.player, firstCollectible)) {
      nextState = movePlayer(nextState, direction);
    }

    expect(nextState.collectedKeys).toContain(createPositionKey(firstCollectible));
  });

  it('counts down the stage timer immutably', () => {
    const state = createInitialState('easy', 1);
    const nextState = tickTimer(state, 5);

    expect(state.remainingSeconds).toBe(state.roundTimeSeconds);
    expect(nextState.remainingSeconds).toBe(state.roundTimeSeconds - 5);
    expect(nextState.elapsedSeconds).toBe(5);
  });

  it('advances to a fresh stage with cumulative score after exit', () => {
    const state = createInitialState('easy', 321);
    const solvedState = {
      ...state,
      player: state.exit,
      collectedKeys: state.collectibles.map(createPositionKey),
      steps: 12,
      remainingSeconds: 20,
    };

    expect(canExit(solvedState)).toBe(true);

    const nextState = advanceRound(solvedState, 654);

    expect(nextState.round).toBe(2);
    expect(nextState.score).toBeGreaterThan(0);
    expect(nextState.remainingSeconds).toBe(getRoundTimeSeconds(nextState.difficulty, 2));
    expect(countRemainingCollectibles(nextState)).toBe(nextState.difficulty.collectibleCount);
  });

  it('records failure when the timer reaches zero', () => {
    const timedOut = tickTimer(createInitialState('normal', 777), 999);
    const failed = recordFailure(timedOut);

    expect(isTimedOut(timedOut)).toBe(true);
    expect(failed.failures).toBe(1);
    expect(failed.remainingSeconds).toBe(0);
  });

  it('scores later rounds and faster clears higher', () => {
    const early = calculateRoundScore({
      difficultyId: 'normal',
      round: 1,
      remainingSeconds: 10,
      collectedCount: 3,
      steps: 20,
    });
    const later = calculateRoundScore({
      difficultyId: 'normal',
      round: 3,
      remainingSeconds: 25,
      collectedCount: 3,
      steps: 16,
    });

    expect(later).toBeGreaterThan(early);
  });

  it('produces stable pseudo-random values', () => {
    const random = createSeededRandom(42);
    const values = [random(), random(), random()];

    expect(values).toEqual([0.2523451747838408, 0.08812504541128874, 0.5772811982315034]);
  });
});
