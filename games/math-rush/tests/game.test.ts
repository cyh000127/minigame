import { describe, expect, it } from 'vitest';
import {
  calculateRoundScore,
  createInitialState,
  formatTime,
  generateChallenge,
  getDifficulty,
  getRoundTimeMs,
  isGameOver,
  nextRandom,
  submitAnswer,
  tickTimer,
} from '../src/game';

describe('Math Rush rules', () => {
  it('creates deterministic challenges from the same seed', () => {
    const first = createInitialState('normal', 135);
    const second = createInitialState('normal', 135);

    expect(first.challenge).toEqual(second.challenge);
    expect(first.seed).toBe(second.seed);
  });

  it('generates four unique options that include the answer', () => {
    const generated = generateChallenge(12, 2468);
    const options = generated.challenge.options;

    expect(new Set(options).size).toBe(4);
    expect(options).toContain(generated.challenge.answer);
    expect(options[generated.challenge.correctIndex]).toBe(generated.challenge.answer);
  });

  it('unlocks subtraction and multiplication as rounds advance', () => {
    expect(generateChallenge(1, 1).challenge.operation).toBe('add');

    expect(generateChallenge(6, 682).challenge.operation).toBe('subtract');
    expect(generateChallenge(12, 1112).challenge.operation).toBe('multiply');
  });

  it('decreases round time without going below the difficulty minimum', () => {
    const difficulty = getDifficulty('hard');

    expect(getRoundTimeMs(difficulty, 1)).toBe(difficulty.startTimeMs);
    expect(getRoundTimeMs(difficulty, 999)).toBe(difficulty.minTimeMs);
  });

  it('advances round, streak and score after a correct answer', () => {
    const state = createInitialState('easy', 777);
    const result = submitAnswer(state, state.challenge.correctIndex);

    expect(result.correct).toBe(true);
    expect(result.scoreGain).toBeGreaterThan(0);
    expect(result.state.round).toBe(2);
    expect(result.state.streak).toBe(1);
    expect(result.state.score).toBe(result.scoreGain);
  });

  it('activates fever after five consecutive correct answers', () => {
    let state = createInitialState('normal', 888);

    for (let index = 0; index < 5; index += 1) {
      state = submitAnswer(state, state.challenge.correctIndex).state;
    }

    expect(state.streak).toBe(5);
    expect(state.fever).toBe(true);
    expect(state.bestStreak).toBe(5);
  });

  it('resets streak and removes time after a wrong answer', () => {
    let state = createInitialState('normal', 999);
    state = submitAnswer(state, state.challenge.correctIndex).state;

    const wrongIndex = (state.challenge.correctIndex + 1) % state.challenge.options.length;
    const result = submitAnswer(state, wrongIndex);

    expect(result.correct).toBe(false);
    expect(result.state.streak).toBe(0);
    expect(result.state.remainingMs).toBe(state.remainingMs - state.difficulty.wrongPenaltyMs);
  });

  it('ticks time toward game over and formats the timer', () => {
    const state = createInitialState('hard', 123);
    const nextState = tickTimer(state, state.remainingMs);

    expect(isGameOver(nextState)).toBe(true);
    expect(formatTime(1234)).toBe('1.2');
  });

  it('calculates a larger score for fever streaks', () => {
    const normalScore = calculateRoundScore({
      difficultyId: 'normal',
      round: 4,
      streak: 4,
      remainingMs: 3000,
      maxTimeMs: 5000,
    });
    const feverScore = calculateRoundScore({
      difficultyId: 'normal',
      round: 5,
      streak: 5,
      remainingMs: 3000,
      maxTimeMs: 5000,
    });

    expect(feverScore).toBeGreaterThan(normalScore);
  });

  it('returns stable pseudo-random values between zero and one', () => {
    const first = nextRandom(42);
    const second = nextRandom(first.seed);

    expect(first.value).toBe(0.2523451747838408);
    expect(second.value).toBe(0.08812504541128874);
  });
});
