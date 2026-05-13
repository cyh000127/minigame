import { describe, expect, it } from 'vitest';
import {
  EMPTY,
  calculateScore,
  createPuzzleState,
  createSolvedBoard,
  getDifficulty,
  getEmptyIndex,
  getMovableIndexes,
  isSolvable,
  isSolved,
  moveByDirection,
  moveTile,
  shuffleBoard,
  tickTimer,
  type RandomSource,
} from './game';

function seededRandom(seed: number): RandomSource {
  let value = seed;

  return () => {
    value = (value * 48271) % 2_147_483_647;
    return value / 2_147_483_647;
  };
}

describe('Sliding Puzzle engine', () => {
  it('creates solved boards for a given size', () => {
    expect(createSolvedBoard(3)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, EMPTY]);
    expect(isSolved(createSolvedBoard(4))).toBe(true);
  });

  it('finds movable tiles around the empty tile', () => {
    expect(getMovableIndexes(createSolvedBoard(3), 3)).toEqual([5, 7]);
  });

  it('moves only tiles adjacent to the empty tile', () => {
    const solved = createSolvedBoard(3);
    const moved = moveTile(solved, 3, 7);

    expect(moved).toEqual([1, 2, 3, 4, 5, 6, 7, EMPTY, 8]);
    expect(moveTile(solved, 3, 0)).toBe(solved);
  });

  it('moves tiles with keyboard directions', () => {
    let board = createSolvedBoard(3);
    board = moveByDirection(board, 3, 'up');
    board = moveByDirection(board, 3, 'left');

    expect(board).toEqual([1, 2, 3, 4, EMPTY, 5, 7, 8, 6]);
  });

  it('generates shuffled boards that are solvable and not already solved', () => {
    for (const difficultyId of ['easy', 'normal', 'hard'] as const) {
      const difficulty = getDifficulty(difficultyId);
      const board = shuffleBoard(difficulty, seededRandom(difficulty.size * 100));

      expect(board).toHaveLength(difficulty.size * difficulty.size);
      expect(getEmptyIndex(board)).toBeGreaterThanOrEqual(0);
      expect(isSolvable(board, difficulty.size)).toBe(true);
      expect(isSolved(board)).toBe(false);
    }
  });

  it('detects unsolvable swapped boards', () => {
    expect(isSolvable([1, 2, 3, 4, 5, 6, 8, 7, EMPTY], 3)).toBe(false);
  });

  it('creates puzzle state and ticks time', () => {
    const state = createPuzzleState('easy', seededRandom(7));
    const next = tickTimer(state, 5);

    expect(state.moves).toBe(0);
    expect(next.elapsedSeconds).toBe(5);
  });

  it('scores harder clears higher before penalties', () => {
    const easyScore = calculateScore({ difficultyId: 'easy', elapsedSeconds: 60, moves: 40 });
    const hardScore = calculateScore({ difficultyId: 'hard', elapsedSeconds: 60, moves: 40 });

    expect(hardScore).toBeGreaterThan(easyScore);
  });
});
