import { describe, expect, it } from 'vitest';
import {
  applyMoves,
  calculateScore,
  countLightsOn,
  createPuzzleState,
  createSolvedBoard,
  getDifficulty,
  getToggleIndexes,
  isSolved,
  tickTimer,
  toggleAt,
  type LightBoard,
  type RandomSource,
} from './game';

function seededRandom(seed: number): RandomSource {
  let value = seed;

  return () => {
    value = (value * 48271) % 2_147_483_647;
    return value / 2_147_483_647;
  };
}

describe('Lights Out engine', () => {
  it('creates a solved board with every light off', () => {
    const board = createSolvedBoard(3);

    expect(board).toHaveLength(9);
    expect(isSolved(board)).toBe(true);
    expect(countLightsOn(board)).toBe(0);
  });

  it('returns cross toggle indexes without wrapping rows', () => {
    expect(getToggleIndexes(3, 0)).toEqual([0, 1, 3]);
    expect(getToggleIndexes(3, 4)).toEqual([1, 3, 4, 5, 7]);
    expect(getToggleIndexes(3, 8)).toEqual([5, 7, 8]);
  });

  it('toggles self and orthogonal neighbors', () => {
    const board = toggleAt(createSolvedBoard(3), 3, 4);

    expect(board).toEqual([
      false, true, false,
      true, true, true,
      false, true, false,
    ]);
  });

  it('same toggle twice returns to the original board', () => {
    const board = createSolvedBoard(5);
    const toggled = toggleAt(board, 5, 12);
    const restored = toggleAt(toggled, 5, 12);

    expect(restored).toEqual(board);
  });

  it('generates puzzles that can be solved by replaying solution moves', () => {
    for (const difficultyId of ['easy', 'normal', 'hard'] as const) {
      const state = createPuzzleState(difficultyId, seededRandom(difficultyId.length * 100));
      const solved = applyMoves(state.board, state.difficulty.size, state.solutionMoves);

      expect(state.board).toHaveLength(state.difficulty.size * state.difficulty.size);
      expect(countLightsOn(state.board)).toBeGreaterThan(0);
      expect(isSolved(solved)).toBe(true);
    }
  });

  it('creates larger boards for harder difficulties', () => {
    expect(getDifficulty('easy').size).toBeLessThan(getDifficulty('normal').size);
    expect(getDifficulty('normal').size).toBeLessThan(getDifficulty('hard').size);
  });

  it('ticks elapsed time without mutating the original state', () => {
    const state = createPuzzleState('easy', seededRandom(9));
    const next = tickTimer(state, 8);

    expect(state.elapsedSeconds).toBe(0);
    expect(next.elapsedSeconds).toBe(8);
  });

  it('scores harder clears higher before penalties', () => {
    const easyScore = calculateScore({ difficultyId: 'easy', elapsedSeconds: 45, moves: 10 });
    const hardScore = calculateScore({ difficultyId: 'hard', elapsedSeconds: 45, moves: 10 });

    expect(hardScore).toBeGreaterThan(easyScore);
  });

  it('keeps invalid toggles as the same board reference', () => {
    const board: LightBoard = createSolvedBoard(3);

    expect(toggleAt(board, 3, -1)).toBe(board);
    expect(toggleAt(board, 3, 99)).toBe(board);
  });
});
