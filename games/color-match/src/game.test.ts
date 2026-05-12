import { describe, expect, it } from 'vitest';
import {
  chooseDirection,
  createRound,
  getColorForDirection,
  getDirectionForColor,
  getForbiddenChance,
  getMaxTimeMs,
  getSpeedLevel,
  getTimerDrainMultiplier,
  isFeverActive,
  SETTINGS,
  startGame,
  tickTimer,
  type RandomSource,
} from './game';

function sequenceRandom(values: number[]): RandomSource {
  let index = 0;

  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

describe('Color Match engine', () => {
  it('maps each direction to a fixed color', () => {
    expect(getColorForDirection('up').color).toBe('red');
    expect(getColorForDirection('right').color).toBe('yellow');
    expect(getColorForDirection('down').color).toBe('blue');
    expect(getColorForDirection('left').color).toBe('green');
    expect(getDirectionForColor('red')).toBe('up');
  });

  it('creates a normal match round by default', () => {
    const round = createRound(1, sequenceRandom([0, 0.99]));

    expect(round.targetColor).toBe('red');
    expect(round.rule).toBe('match');
    expect(round.correctDirection).toBe('up');
  });

  it('uses the opposite color for trap rounds', () => {
    const round = createRound(1, sequenceRandom([0, 0]));

    expect(round.targetColor).toBe('red');
    expect(round.rule).toBe('opposite');
    expect(round.correctColor).toBe('blue');
    expect(round.correctDirection).toBe('down');
  });

  it('accepts any non-forbidden direction for forbidden rounds', () => {
    const round = createRound(1, sequenceRandom([0, getTrapChanceForTest(1) + 0.01]));
    const state = {
      ...startGame(sequenceRandom([0, 0.99])),
      round,
    };
    const safe = chooseDirection(state, 'right', 1_000, sequenceRandom([0, 0.99]));
    const forbidden = chooseDirection(state, 'up', 1_000, sequenceRandom([0, 0.99]));

    expect(round.rule).toBe('forbidden');
    expect(round.acceptedDirections).not.toContain('up');
    expect(safe.phase).toBe('playing');
    expect(forbidden.phase).toBe('game-over');
  });

  it('can ask the player to repeat the previous direction', () => {
    const roll = getTrapChanceForTest(3) + getForbiddenChance(3) + 0.01;
    const round = createRound(3, sequenceRandom([0.8, roll]), 'left');

    expect(round.rule).toBe('repeat');
    expect(round.correctDirection).toBe('left');
  });

  it('adds score, streak, time and a new round on correct input', () => {
    const random = sequenceRandom([0, 0.99, 0.5, 0.99]);
    const started = { ...startGame(random), timeLeftMs: 1_000 };
    const next = chooseDirection(started, 'up', 1_000, random);

    expect(next.phase).toBe('playing');
    expect(next.score).toBeGreaterThan(0);
    expect(next.streak).toBe(1);
    expect(next.timeLeftMs).toBe(1_700);
    expect(next.roundIndex).toBe(2);
    expect(next.round.targetColor).toBe('blue');
  });

  it('ends the game immediately on wrong input', () => {
    const started = startGame(sequenceRandom([0, 0.99]));
    const next = chooseDirection(started, 'left', 1_000);

    expect(next.phase).toBe('game-over');
    expect(next.feedback.kind).toBe('wrong');
    expect(next.streak).toBe(0);
  });

  it('raises speed and tightens max timer every six correct answers', () => {
    let state = startGame(sequenceRandom([0, 0.99]));
    const random = sequenceRandom([0, 0.99]);

    for (let index = 0; index < SETTINGS.speedStepEvery; index += 1) {
      state = chooseDirection(state, state.round.correctDirection, 1_000 + index, random);
    }

    expect(getSpeedLevel(SETTINGS.speedStepEvery)).toBe(2);
    expect(state.speedLevel).toBe(2);
    expect(state.maxTimeMs).toBeLessThan(getMaxTimeMs(1));
  });

  it('starts fever time after a long streak', () => {
    let state = startGame(sequenceRandom([0, 0.99]));
    const random = sequenceRandom([0, 0.99]);

    for (let index = 0; index < SETTINGS.feverThreshold; index += 1) {
      state = chooseDirection(state, state.round.correctDirection, 2_000 + index * 100, random);
    }

    expect(isFeverActive(state, 2_700)).toBe(true);
    expect(state.feedback.message).toContain('FEVER');
  });

  it('drains the timer faster at higher speed and ends on timeout', () => {
    const started = {
      ...startGame(sequenceRandom([0, 0.99])),
      speedLevel: 5,
      timeLeftMs: 1_000,
    };

    expect(getTimerDrainMultiplier(5, false)).toBeGreaterThan(getTimerDrainMultiplier(1, false));

    const next = tickTimer(started, 1_000, 3_000);

    expect(next.phase).toBe('game-over');
    expect(next.feedback.kind).toBe('timeout');
  });
});

function getTrapChanceForTest(speedLevel: number): number {
  return Math.min(SETTINGS.maxTrapChance, 0.08 + speedLevel * 0.018);
}
