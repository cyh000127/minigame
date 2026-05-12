import { describe, expect, it } from 'vitest';
import {
  ROUND_LIMIT,
  advanceRound,
  createGameState,
  createTargetZone,
  evaluateStop,
  forceGameOver,
  getCursorSpeed,
  getResultLabel,
  getZoneWidth,
  pauseGame,
  resumeGame,
  startGame,
  stopCursor,
  tickGame,
  type PerfectStopState,
} from './game';

describe('perfect stop engine', () => {
  it('creates a ready state with best score preserved', () => {
    const state = createGameState(1200);

    expect(state.phase).toBe('ready');
    expect(state.round).toBe(0);
    expect(state.lives).toBe(3);
    expect(state.bestScore).toBe(1200);
  });

  it('starts round one with a deterministic target zone', () => {
    const state = startGame(createGameState(), () => 0);

    expect(state.phase).toBe('playing');
    expect(state.round).toBe(1);
    expect(state.cursor).toBe(0);
    expect(state.target).toEqual({ center: 0.15, width: 0.3 });
  });

  it('moves the cursor using delta time', () => {
    const state = startGame(createGameState(), () => 0.5);
    const nextState = tickGame(state, 500);

    expect(nextState.cursor).toBeCloseTo(0.21);
    expect(nextState.direction).toBe(1);
  });

  it('bounces the cursor at meter edges', () => {
    const state: PerfectStopState = {
      ...startGame(createGameState(), () => 0.5),
      cursor: 0.95,
      direction: 1,
    };

    const nextState = tickGame(state, 200);

    expect(nextState.cursor).toBeLessThan(1);
    expect(nextState.direction).toBe(-1);
  });

  it('scores a successful stop and moves to feedback', () => {
    const state: PerfectStopState = {
      ...startGame(createGameState(), () => 0.5),
      cursor: 0.5,
      streak: 2,
    };

    const nextState = stopCursor(state);

    expect(nextState.phase).toBe('feedback');
    expect(nextState.lives).toBe(3);
    expect(nextState.streak).toBe(3);
    expect(nextState.score).toBeGreaterThan(0);
    expect(nextState.bestScore).toBe(nextState.score);
    expect(nextState.lastResult?.message).toBe('perfect');
  });

  it('removes a life on miss and resets streak', () => {
    const state: PerfectStopState = {
      ...startGame(createGameState(), () => 0.5),
      cursor: 0,
      streak: 4,
    };

    const nextState = stopCursor(state);

    expect(nextState.phase).toBe('feedback');
    expect(nextState.lives).toBe(2);
    expect(nextState.streak).toBe(0);
    expect(nextState.score).toBe(0);
    expect(nextState.lastResult?.message).toBe('miss');
  });

  it('ends the game when the last life is missed', () => {
    const state: PerfectStopState = {
      ...startGame(createGameState(), () => 0.5),
      cursor: 0,
      lives: 1,
    };

    const nextState = stopCursor(state);

    expect(nextState.phase).toBe('game-over');
    expect(nextState.lives).toBe(0);
  });

  it('finishes after a successful final round', () => {
    const state: PerfectStopState = {
      ...startGame(createGameState(), () => 0.5),
      round: ROUND_LIMIT,
      cursor: 0.5,
    };

    const nextState = stopCursor(state);

    expect(nextState.phase).toBe('finished');
  });

  it('advances feedback into a new round with a fresh target', () => {
    const state = stopCursor({
      ...startGame(createGameState(), () => 0.5),
      cursor: 0.5,
    });
    const nextState = advanceRound(state, () => 1);

    expect(nextState.phase).toBe('playing');
    expect(nextState.round).toBe(2);
    expect(nextState.lastResult).toBeNull();
    expect(nextState.target.center).toBeCloseTo(0.859);
  });

  it('pauses and resumes active states', () => {
    const playing = startGame(createGameState(), () => 0.5);
    const paused = pauseGame(playing);

    expect(paused.phase).toBe('paused');
    expect(paused.previousPhase).toBe('playing');
    expect(resumeGame(paused).phase).toBe('playing');
    expect(pauseGame(createGameState()).phase).toBe('ready');
  });

  it('calculates speed, zone width, target, and labels', () => {
    expect(getCursorSpeed(1)).toBeCloseTo(0.42);
    expect(getCursorSpeed(4)).toBeCloseTo(0.54);
    expect(getZoneWidth(1)).toBeCloseTo(0.3);
    expect(getZoneWidth(50)).toBe(0.08);
    expect(createTargetZone(1, () => 0.5)).toEqual({ center: 0.5, width: 0.3 });
    expect(evaluateStop(0.5, { center: 0.5, width: 0.2 }, 2, 0).message).toBe('perfect');
    expect(getResultLabel({ success: false, accuracy: 0, points: 0, message: 'miss' })).toBe('MISS');
  });

  it('forces game over while preserving best score', () => {
    const state = forceGameOver({ ...createGameState(100), score: 250 });

    expect(state.phase).toBe('game-over');
    expect(state.bestScore).toBe(250);
  });
});
