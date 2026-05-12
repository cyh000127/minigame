import { describe, expect, it } from 'vitest';
import {
  clearInput,
  createFallingWord,
  createGameState,
  deleteCharacter,
  forceGameOver,
  getLevel,
  getSpawnIntervalMs,
  getWordScore,
  getWordSpeed,
  pauseGame,
  resumeGame,
  startGame,
  submitInput,
  tickGame,
  type TypeRainState,
  typeCharacter,
} from './game';

describe('type rain engine', () => {
  it('creates a ready state with best score preserved', () => {
    const state = createGameState(500);

    expect(state.phase).toBe('ready');
    expect(state.words).toEqual([]);
    expect(state.lives).toBe(3);
    expect(state.bestScore).toBe(500);
  });

  it('starts with one deterministic falling word', () => {
    const randomValues = [0, 0.5];
    const state = startGame(createGameState(), () => randomValues.shift() ?? 0);

    expect(state.phase).toBe('playing');
    expect(state.words[0]).toMatchObject({
      id: 1,
      text: 'CODE',
      x: 0.5,
      y: -0.08,
    });
    expect(state.nextWordId).toBe(2);
  });

  it('moves words with delta time', () => {
    const state = startGame(createGameState(), () => 0);
    const nextState = tickGame(state, 1000);

    expect(nextState.words[0]?.y).toBeCloseTo(0.04);
  });

  it('spawns new words when cooldown expires', () => {
    const randomValues = [0, 0.5, 0.25, 0.25];
    const state = startGame(createGameState(), () => randomValues.shift() ?? 0);
    const nextState = tickGame(state, 1400, () => randomValues.shift() ?? 0);

    expect(nextState.words).toHaveLength(2);
    expect(nextState.words[1]?.id).toBe(2);
    expect(nextState.words[1]?.text).toBe('STACK');
  });

  it('removes missed words and ends at zero lives', () => {
    const state: TypeRainState = {
      ...startGame(createGameState(), () => 0),
      lives: 1,
      words: [{ id: 1, text: 'CODE', x: 0.5, y: 0.99, speed: 0.12 }],
    };

    const nextState = tickGame(state, 200);

    expect(nextState.phase).toBe('game-over');
    expect(nextState.lives).toBe(0);
    expect(nextState.words).toEqual([]);
  });

  it('types, deletes, and clears input while playing', () => {
    const state = startGame(createGameState(), () => 0);
    const typed = typeCharacter(typeCharacter(state, 'c'), '1');
    const deleted = deleteCharacter(typed);

    expect(typed.input).toBe('C');
    expect(deleted.input).toBe('');
    expect(clearInput(typeCharacter(state, 'a')).input).toBe('');
  });

  it('submits a correct word and scores by level and streak', () => {
    const state: TypeRainState = {
      ...startGame(createGameState(), () => 0),
      input: 'CODE',
      streak: 2,
      words: [{ id: 1, text: 'CODE', x: 0.5, y: 0.2, speed: 0.12 }],
    };

    const nextState = submitInput(state);

    expect(nextState.words).toEqual([]);
    expect(nextState.input).toBe('');
    expect(nextState.score).toBe(getWordScore('CODE', 1, 2));
    expect(nextState.streak).toBe(3);
  });

  it('clears input and resets streak on wrong submit', () => {
    const state: TypeRainState = {
      ...startGame(createGameState(), () => 0),
      input: 'MISS',
      streak: 3,
    };

    const nextState = submitInput(state);

    expect(nextState.input).toBe('');
    expect(nextState.streak).toBe(0);
    expect(nextState.words).toHaveLength(1);
  });

  it('pauses and resumes only playing state', () => {
    const playing = startGame(createGameState(), () => 0);
    const paused = pauseGame(playing);

    expect(paused.phase).toBe('paused');
    expect(resumeGame(paused).phase).toBe('playing');
    expect(pauseGame(createGameState()).phase).toBe('ready');
  });

  it('calculates level, speed, interval, and word score', () => {
    expect(getLevel(0)).toBe(1);
    expect(getLevel(240)).toBe(2);
    expect(getWordSpeed(1)).toBeCloseTo(0.12);
    expect(getWordSpeed(3)).toBeCloseTo(0.17);
    expect(getSpawnIntervalMs(1)).toBe(1400);
    expect(getSpawnIntervalMs(20)).toBe(620);
    expect(getWordScore('ARCADE', 2, 3)).toBe(144);
  });

  it('creates a deterministic word from the word bank', () => {
    const randomValues = [0.99, 1];
    const word = createFallingWord(10, 4, () => randomValues.shift() ?? 0);

    expect(word).toMatchObject({
      id: 10,
      text: 'VECTOR',
      y: -0.08,
      speed: getWordSpeed(4),
    });
    expect(word.x).toBeCloseTo(0.92);
  });

  it('forces game over while preserving best score', () => {
    const state = forceGameOver({ ...createGameState(100), score: 250 });

    expect(state.phase).toBe('game-over');
    expect(state.bestScore).toBe(250);
  });
});
