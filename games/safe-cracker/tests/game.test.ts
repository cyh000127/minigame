import { describe, expect, it } from 'vitest';
import { computeRoundScore, createSequence, createStageSpec, parseBest } from '../src/game';

describe('safe-cracker game logic', () => {
  it('scales stage difficulty upward', () => {
    const early = createStageSpec(1);
    const later = createStageSpec(5);

    expect(later.sequenceLength).toBeGreaterThan(early.sequenceLength);
    expect(later.revealMs).toBeLessThan(early.revealMs);
    expect(later.inputTimeMs).toBeLessThan(early.inputTimeMs);
  });

  it('creates a numeric sequence with the requested length', () => {
    const sequence = createSequence(6, () => 0.4);
    expect(sequence).toHaveLength(6);
    expect(sequence).toMatch(/^\d+$/);
  });

  it('rewards better time and streak with higher score', () => {
    const low = computeRoundScore(2, 1000, 1);
    const high = computeRoundScore(2, 5000, 4);
    expect(high).toBeGreaterThan(low);
  });

  it('parses persisted best score safely', () => {
    expect(parseBest('{"score":1500,"stage":4,"createdAt":"2026-05-18T00:00:00.000Z"}')).toEqual({
      score: 1500,
      stage: 4,
      createdAt: '2026-05-18T00:00:00.000Z',
    });
    expect(parseBest('{"score":"bad"}')).toBeNull();
  });
});
