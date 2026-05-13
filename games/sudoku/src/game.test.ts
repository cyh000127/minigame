import { describe, expect, it } from 'vitest';
import {
  BOARD_SIZE,
  BOX_SIZE,
  CELL_COUNT,
  EMPTY,
  calculateScore,
  countSolutions,
  createSolvedBoard,
  generatePuzzle,
  getCandidates,
  getConflictingIndexes,
  getDifficulty,
  type RandomSource,
  type SudokuBoard,
} from './game';

function seededRandom(seed: number): RandomSource {
  let value = seed;

  return () => {
    value = (value * 48271) % 2_147_483_647;
    return value / 2_147_483_647;
  };
}

function expectValidSolvedBoard(board: SudokuBoard): void {
  expect(board).toHaveLength(CELL_COUNT);

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const values = board.slice(row * BOARD_SIZE, row * BOARD_SIZE + BOARD_SIZE);
    expect(new Set(values)).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  }

  for (let column = 0; column < BOARD_SIZE; column += 1) {
    const values = Array.from({ length: BOARD_SIZE }, (_, row) => board[row * BOARD_SIZE + column]);
    expect(new Set(values)).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  }

  for (let boxRow = 0; boxRow < BOX_SIZE; boxRow += 1) {
    for (let boxColumn = 0; boxColumn < BOX_SIZE; boxColumn += 1) {
      const values: number[] = [];

      for (let rowOffset = 0; rowOffset < BOX_SIZE; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < BOX_SIZE; columnOffset += 1) {
          const row = boxRow * BOX_SIZE + rowOffset;
          const column = boxColumn * BOX_SIZE + columnOffset;
          values.push(board[row * BOARD_SIZE + column] ?? EMPTY);
        }
      }

      expect(new Set(values)).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    }
  }
}

describe('Sudoku engine', () => {
  it('creates a valid solved board', () => {
    expectValidSolvedBoard(createSolvedBoard(seededRandom(1)));
  });

  it('generates uniquely solvable puzzles for every difficulty', () => {
    for (const difficultyId of ['easy', 'normal', 'hard'] as const) {
      const puzzle = generatePuzzle(difficultyId, seededRandom(difficultyId.length * 1_000));
      const givenCount = puzzle.puzzle.filter((value) => value !== EMPTY).length;

      expect(givenCount).toBeGreaterThanOrEqual(getDifficulty(difficultyId).givenCount);
      expect(countSolutions(puzzle.puzzle)).toBe(1);
      expectValidSolvedBoard(puzzle.solution);
    }
  });

  it('makes harder difficulties expose fewer fixed cells', () => {
    const easy = generatePuzzle('easy', seededRandom(10)).puzzle.filter((value) => value !== EMPTY).length;
    const normal = generatePuzzle('normal', seededRandom(20)).puzzle.filter((value) => value !== EMPTY).length;
    const hard = generatePuzzle('hard', seededRandom(30)).puzzle.filter((value) => value !== EMPTY).length;

    expect(easy).toBeGreaterThanOrEqual(normal);
    expect(normal).toBeGreaterThanOrEqual(hard);
  });

  it('returns candidates that do not duplicate row, column, or box values', () => {
    const board = [
      5, 3, 0, 0, 7, 0, 0, 0, 0,
      6, 0, 0, 1, 9, 5, 0, 0, 0,
      0, 9, 8, 0, 0, 0, 0, 6, 0,
      8, 0, 0, 0, 6, 0, 0, 0, 3,
      4, 0, 0, 8, 0, 3, 0, 0, 1,
      7, 0, 0, 0, 2, 0, 0, 0, 6,
      0, 6, 0, 0, 0, 0, 2, 8, 0,
      0, 0, 0, 4, 1, 9, 0, 0, 5,
      0, 0, 0, 0, 8, 0, 0, 7, 9,
    ];

    expect(getCandidates(board, 2)).toEqual([1, 2, 4]);
  });

  it('detects conflicting duplicated values', () => {
    const board = Array.from({ length: CELL_COUNT }, () => EMPTY);
    board[0] = 5;
    board[8] = 5;
    board[40] = 7;
    board[49] = 7;

    expect([...getConflictingIndexes(board)].sort((left, right) => left - right)).toEqual([0, 8, 40, 49]);
  });

  it('scores harder clears higher before penalties', () => {
    const easyScore = calculateScore({ difficultyId: 'easy', elapsedSeconds: 120, mistakes: 0, hints: 0 });
    const hardScore = calculateScore({ difficultyId: 'hard', elapsedSeconds: 120, mistakes: 0, hints: 0 });

    expect(hardScore).toBeGreaterThan(easyScore);
  });
});
