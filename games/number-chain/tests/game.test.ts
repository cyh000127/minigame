import { describe, expect, it } from 'vitest';
import {
  computeRoundScore,
  createStageConfig,
  generateBoard,
  isAdjacent,
  parseBest,
} from '../src/game';

describe('number-chain game logic', () => {
  it('scales stage difficulty upward', () => {
    const early = createStageConfig(1);
    const later = createStageConfig(5);

    expect(later.gridSize).toBeGreaterThanOrEqual(early.gridSize);
    expect(later.targetLength).toBeGreaterThan(early.targetLength);
    expect(later.timeLimitMs).toBeLessThan(early.timeLimitMs);
  });

  it('generates a board with a contiguous numbered path', () => {
    const board = generateBoard(3, () => 0.4);
    const pathValues = board.path.map((position) => {
      const index = position.row * board.size + position.col;
      return board.cells[index]?.value;
    });

    expect(pathValues).toEqual(pathValues.slice().sort((a, b) => (a ?? 0) - (b ?? 0)));

    for (let index = 1; index < board.path.length; index += 1) {
      expect(isAdjacent(board.path[index - 1]!, board.path[index]!)).toBe(true);
    }
  });

  it('rewards more time and streak with higher score', () => {
    const low = computeRoundScore(2, 1000, 1);
    const high = computeRoundScore(2, 5000, 4);

    expect(high).toBeGreaterThan(low);
  });

  it('parses persisted best score safely', () => {
    expect(parseBest('{"score":1200,"stage":4,"createdAt":"2026-05-18T00:00:00.000Z"}')).toEqual({
      score: 1200,
      stage: 4,
      createdAt: '2026-05-18T00:00:00.000Z',
    });
    expect(parseBest('{"score":"bad"}')).toBeNull();
  });
});
