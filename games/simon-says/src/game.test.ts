import { describe, expect, it } from 'vitest';
import {
  createGameState,
  finishShowing,
  forceGameOver,
  getCueDurationMs,
  getCueGapMs,
  getKeyboardPad,
  getRandomPad,
  getSpeedLevel,
  pauseGame,
  pressPad,
  resumeGame,
  startGame,
  type SimonState,
} from './game';

describe('simon says engine', () => {
  it('creates a ready state with best score preserved', () => {
    const state = createGameState(300);

    expect(state.phase).toBe('ready');
    expect(state.sequence).toEqual([]);
    expect(state.score).toBe(0);
    expect(state.bestScore).toBe(300);
  });

  it('starts the first round with one random pad', () => {
    const state = startGame(createGameState(), () => 0.3);

    expect(state.phase).toBe('showing');
    expect(state.round).toBe(1);
    expect(state.sequence).toEqual(['right']);
  });

  it('moves from showing sequence to input phase', () => {
    const state = finishShowing(startGame(createGameState(), () => 0));

    expect(state.phase).toBe('input');
    expect(state.inputIndex).toBe(0);
  });

  it('advances input index and score after a correct non-final input', () => {
    const state: SimonState = {
      phase: 'input',
      previousPhase: null,
      sequence: ['up', 'left'],
      inputIndex: 0,
      round: 2,
      score: 0,
      bestScore: 0,
      streak: 0,
    };

    const nextState = pressPad(state, 'up');

    expect(nextState.phase).toBe('input');
    expect(nextState.inputIndex).toBe(1);
    expect(nextState.score).toBe(20);
    expect(nextState.streak).toBe(1);
  });

  it('completes a round, adds a new pad, and applies bonus score', () => {
    const state: SimonState = {
      phase: 'input',
      previousPhase: null,
      sequence: ['up'],
      inputIndex: 0,
      round: 1,
      score: 0,
      bestScore: 0,
      streak: 0,
    };

    const nextState = pressPad(state, 'up', () => 0.99);

    expect(nextState.phase).toBe('showing');
    expect(nextState.round).toBe(2);
    expect(nextState.sequence).toEqual(['up', 'left']);
    expect(nextState.score).toBe(60);
    expect(nextState.bestScore).toBe(60);
  });

  it('ends the game on wrong input while preserving best score', () => {
    const state: SimonState = {
      phase: 'input',
      previousPhase: null,
      sequence: ['down'],
      inputIndex: 0,
      round: 4,
      score: 180,
      bestScore: 120,
      streak: 5,
    };

    const nextState = pressPad(state, 'right');

    expect(nextState.phase).toBe('game-over');
    expect(nextState.bestScore).toBe(180);
    expect(nextState.streak).toBe(0);
  });

  it('pauses and resumes active phases only', () => {
    const showing = startGame(createGameState(), () => 0);
    const paused = pauseGame(showing);

    expect(paused.phase).toBe('paused');
    expect(paused.previousPhase).toBe('showing');
    expect(resumeGame(paused).phase).toBe('showing');
    expect(pauseGame(createGameState()).phase).toBe('ready');
  });

  it('forces game over from any active state', () => {
    const state = finishShowing(startGame(createGameState(10), () => 0));
    const nextState = forceGameOver({ ...state, score: 80 });

    expect(nextState.phase).toBe('game-over');
    expect(nextState.bestScore).toBe(80);
  });

  it('calculates speed level and cue timings by round', () => {
    expect(getSpeedLevel(1)).toBe(1);
    expect(getSpeedLevel(4)).toBe(2);
    expect(getCueDurationMs(1)).toBe(620);
    expect(getCueDurationMs(40)).toBe(260);
    expect(getCueGapMs(1)).toBe(180);
    expect(getCueGapMs(40)).toBe(90);
  });

  it('maps random values and keyboard input to pads', () => {
    expect(getRandomPad(() => 0)).toBe('up');
    expect(getRandomPad(() => 0.25)).toBe('right');
    expect(getRandomPad(() => 0.5)).toBe('down');
    expect(getRandomPad(() => 0.99)).toBe('left');
    expect(getKeyboardPad('ArrowUp')).toBe('up');
    expect(getKeyboardPad('KeyD')).toBe('right');
    expect(getKeyboardPad('s')).toBe('down');
    expect(getKeyboardPad('x')).toBeNull();
  });

  it('ignores pad presses outside input phase', () => {
    const state = startGame(createGameState(), () => 0);

    expect(pressPad(state, 'up')).toBe(state);
  });
});
