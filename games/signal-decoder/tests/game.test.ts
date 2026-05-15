import { describe, expect, it } from 'vitest';
import {
  calculateStageScore,
  createInitialState,
  createSeededRandom,
  createSequence,
  getSequenceLength,
  getStageTimeSeconds,
  isFailed,
  isTimedOut,
  recordFailure,
  submitSignal,
  tickTimer,
} from '../src/game';

describe('Signal Decoder rules', () => {
  it('creates deterministic sequences from the same seed', () => {
    const first = createInitialState('normal', 135);
    const second = createInitialState('normal', 135);

    expect(first.sequence).toEqual(second.sequence);
    expect(first.stageTimeSeconds).toBe(second.stageTimeSeconds);
  });

  it('increases sequence length as stages progress', () => {
    const state = createInitialState('easy', 1, 3);

    expect(state.sequence).toHaveLength(getSequenceLength(state.difficulty, 3));
  });

  it('advances progress on a correct input', () => {
    const state = createInitialState('easy', 22);
    const expected = state.sequence[0];

    expect(expected).toBeDefined();

    if (!expected) {
      return;
    }

    const result = submitSignal(state, expected);

    expect(result.correct).toBe(true);
    expect(result.state.progressIndex).toBe(1);
    expect(result.clearedStage).toBe(false);
  });

  it('clears the stage and creates a new sequence at the end', () => {
    let state = createInitialState('easy', 77);

    for (const direction of state.sequence) {
      const result = submitSignal(state, direction);
      state = result.state;

      if (result.clearedStage) {
        expect(result.scoreGain).toBeGreaterThan(0);
        expect(state.stage).toBe(2);
        expect(state.score).toBe(result.scoreGain);
        return;
      }
    }

    throw new Error('Stage was not cleared.');
  });

  it('applies strike penalties on wrong input and fails after three strikes', () => {
    let state = createInitialState('normal', 33);

    for (let index = 0; index < 3; index += 1) {
      const wrong = state.sequence[state.progressIndex] === 'up' ? 'left' : 'up';
      const result = submitSignal(state, wrong);
      state = result.state;
    }

    expect(state.strikes).toBe(3);
    expect(isFailed(state)).toBe(true);
  });

  it('counts down the timer and detects timeouts', () => {
    const state = createInitialState('hard', 44);
    const timedOut = tickTimer(state, state.stageTimeSeconds + 1);

    expect(isTimedOut(timedOut)).toBe(true);
    expect(isFailed(timedOut)).toBe(true);
  });

  it('records failure without losing accumulated score', () => {
    const state = createInitialState('easy', 55, 2, 3000, 0);
    const failed = recordFailure(state);

    expect(failed.failures).toBe(1);
    expect(failed.score).toBe(3000);
  });

  it('scores faster and later stages higher', () => {
    const early = calculateStageScore({
      difficultyId: 'normal',
      stage: 1,
      remainingSeconds: 4,
      sequenceLength: 6,
      strikes: 1,
    });
    const later = calculateStageScore({
      difficultyId: 'normal',
      stage: 3,
      remainingSeconds: 10,
      sequenceLength: 8,
      strikes: 0,
    });

    expect(later).toBeGreaterThan(early);
  });

  it('produces stable pseudo-random values', () => {
    const random = createSeededRandom(42);
    const values = [random(), random(), random()];

    expect(values).toEqual([0.2523451747838408, 0.08812504541128874, 0.5772811982315034]);
  });

  it('derives stage time from difficulty and stage', () => {
    const state = createInitialState('hard', 66, 5);

    expect(state.stageTimeSeconds).toBe(getStageTimeSeconds(state.difficulty, 5));
    expect(createSequence(5, 66)).toHaveLength(5);
  });
});
