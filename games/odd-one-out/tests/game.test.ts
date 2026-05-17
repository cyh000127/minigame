import { describe, expect, it } from 'vitest';
import {
  computeCorrectScore,
  createDifficulty,
  createRound,
  parseBestScore,
} from '../src/game';

describe('odd-one-out game logic', () => {
  it('scales difficulty by stage with tighter time and larger grid', () => {
    const early = createDifficulty(1);
    const later = createDifficulty(6);

    expect(early.gridSize).toBe(4);
    expect(later.gridSize).toBeGreaterThan(early.gridSize);
    expect(later.timeLimitMs).toBeLessThan(early.timeLimitMs);
    expect(later.findsToClear).toBeGreaterThanOrEqual(early.findsToClear);
  });

  it('creates an odd tile index inside board bounds', () => {
    const round = createRound(3, () => 0.5);
    const total = round.gridSize * round.gridSize;

    expect(round.oddIndex).toBeGreaterThanOrEqual(0);
    expect(round.oddIndex).toBeLessThan(total);
    expect(round.colors.base).not.toBe(round.colors.odd);
  });

  it('awards higher score for better remaining time and streak', () => {
    const low = computeCorrectScore(2, 1000, 1);
    const high = computeCorrectScore(2, 9000, 4);

    expect(high).toBeGreaterThan(low);
  });

  it('parses persisted best score safely', () => {
    const valid = parseBestScore('{"score":1200,"stage":4,"createdAt":"2026-05-18T00:00:00.000Z"}');
    const invalid = parseBestScore('{"score":"oops"}');

    expect(valid).toEqual({
      score: 1200,
      stage: 4,
      createdAt: '2026-05-18T00:00:00.000Z',
    });
    expect(invalid).toBeNull();
  });
});
