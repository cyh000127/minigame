import { describe, expect, it } from 'vitest';
import {
  GAME_DURATION_MS,
  createGameState,
  createMole,
  forceGameOver,
  getKeyboardHole,
  getLevel,
  getMaxActiveMoles,
  getMoleLifetimeMs,
  getMoleScore,
  getSpawnIntervalMs,
  pauseGame,
  pickEmptyHole,
  resumeGame,
  startGame,
  tickGame,
  whackHole,
  type Mole,
  type WhackMoleState,
} from './game';

describe('whack mole engine', () => {
  it('creates a ready state with best score preserved', () => {
    const state = createGameState(900);

    expect(state.phase).toBe('ready');
    expect(state.holes).toBe(9);
    expect(state.lives).toBe(3);
    expect(state.bestScore).toBe(900);
  });

  it('starts with one deterministic mole', () => {
    const randomValues = [0, 0.5];
    const state = startGame(createGameState(), () => randomValues.shift() ?? 0);

    expect(state.phase).toBe('playing');
    expect(state.moles).toEqual([
      {
        id: 1,
        hole: 0,
        kind: 'normal',
        remainingMs: 1050,
      },
    ]);
    expect(state.nextMoleId).toBe(2);
  });

  it('counts down mole time and game time', () => {
    const state = startGame(createGameState(), () => 0.5);
    const nextState = tickGame(state, 250);

    expect(nextState.moles[0]?.remainingMs).toBe(800);
    expect(nextState.remainingGameMs).toBe(GAME_DURATION_MS - 250);
  });

  it('removes expired moles and loses a life', () => {
    const state = startGame(createGameState(), () => 0);
    const nextState = tickGame(state, 1100);

    expect(nextState.moles).toHaveLength(1);
    expect(nextState.lives).toBe(2);
    expect(nextState.combo).toBe(0);
  });

  it('ends the game when all lives are lost', () => {
    const state: WhackMoleState = {
      ...startGame(createGameState(), () => 0),
      lives: 1,
    };

    const nextState = tickGame(state, 1100);

    expect(nextState.phase).toBe('game-over');
    expect(nextState.lives).toBe(0);
  });

  it('finishes when game time runs out', () => {
    const state: WhackMoleState = {
      ...startGame(createGameState(), () => 0),
      remainingGameMs: 10,
    };

    const nextState = tickGame(state, 20);

    expect(nextState.phase).toBe('finished');
    expect(nextState.remainingGameMs).toBe(0);
  });

  it('scores a whacked mole and increases combo', () => {
    const mole: Mole = { id: 1, hole: 4, kind: 'gold', remainingMs: 800 };
    const state: WhackMoleState = {
      ...startGame(createGameState(), () => 0),
      moles: [mole],
      combo: 2,
    };

    const nextState = whackHole(state, 4);

    expect(nextState.moles).toEqual([]);
    expect(nextState.score).toBe(getMoleScore(mole, 1, 2));
    expect(nextState.combo).toBe(3);
    expect(nextState.bestScore).toBe(nextState.score);
  });

  it('penalizes empty hole hits', () => {
    const state: WhackMoleState = {
      ...startGame(createGameState(), () => 0),
      moles: [],
      lives: 2,
      combo: 4,
    };

    const nextState = whackHole(state, 8);

    expect(nextState.lives).toBe(1);
    expect(nextState.combo).toBe(0);
  });

  it('spawns up to the max active mole count', () => {
    const randomValues = [0.9, 0.9, 0.7, 0.9, 0.4, 0.9, 0.2, 0.9];
    const state: WhackMoleState = {
      ...startGame(createGameState(), () => 0),
      moles: [],
      level: 7,
      spawnCooldownMs: 0,
    };

    const nextState = tickGame(state, 1000, () => randomValues.shift() ?? 0);

    expect(nextState.moles.length).toBeLessThanOrEqual(getMaxActiveMoles(7));
    expect(nextState.nextMoleId).toBeGreaterThan(2);
  });

  it('picks empty holes and creates gold moles deterministically', () => {
    const active: Mole[] = [
      { id: 1, hole: 0, kind: 'normal', remainingMs: 100 },
      { id: 2, hole: 1, kind: 'normal', remainingMs: 100 },
    ];
    const randomValues = [0, 0.1];

    expect(pickEmptyHole(active, () => 0)).toBe(2);
    expect(createMole(3, active, 2, () => randomValues.shift() ?? 0)).toEqual({
      id: 3,
      hole: 2,
      kind: 'gold',
      remainingMs: 1005,
    });
  });

  it('calculates level, timings, and keyboard holes', () => {
    expect(getLevel(0)).toBe(1);
    expect(getLevel(300)).toBe(2);
    expect(getSpawnIntervalMs(1)).toBe(820);
    expect(getSpawnIntervalMs(30)).toBe(330);
    expect(getMoleLifetimeMs(1)).toBe(1050);
    expect(getMoleLifetimeMs(30)).toBe(520);
    expect(getMaxActiveMoles(1)).toBe(1);
    expect(getMaxActiveMoles(7)).toBe(3);
    expect(getKeyboardHole('1')).toBe(0);
    expect(getKeyboardHole('9')).toBe(8);
    expect(getKeyboardHole('0')).toBeNull();
  });

  it('pauses, resumes, and forces game over', () => {
    const playing = startGame(createGameState(), () => 0);
    const paused = pauseGame(playing);

    expect(paused.phase).toBe('paused');
    expect(resumeGame(paused).phase).toBe('playing');
    expect(pauseGame(createGameState()).phase).toBe('ready');

    const ended = forceGameOver({ ...playing, score: 240 });
    expect(ended.phase).toBe('game-over');
    expect(ended.bestScore).toBe(240);
  });
});
