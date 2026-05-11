import { describe, expect, it } from 'vitest';
import {
  calculateStepMs,
  createInitialGameState,
  movePlayer,
  playerRow,
  roadRows,
  startGame,
  updateGame,
  type RoadRacerState
} from './game';

function runningState(partial: Partial<RoadRacerState> = {}): RoadRacerState {
  return {
    ...startGame(),
    ...partial
  };
}

describe('road racer game engine', () => {
  it('starts in ready state and resets into a running round', () => {
    const initialState = createInitialGameState();
    const running = startGame();

    expect(initialState.phase).toBe('ready');
    expect(running.phase).toBe('running');
    expect(running.score).toBe(0);
    expect(running.objects).toEqual([]);
  });

  it('moves the player one lane at a time inside road bounds', () => {
    let state = runningState({ playerLane: 1 });

    state = movePlayer(state, 'left');
    state = movePlayer(state, 'left');
    state = movePlayer(state, 'left');

    expect(state.playerLane).toBe(0);

    state = movePlayer(state, 'right');
    state = movePlayer(state, 'right');
    state = movePlayer(state, 'right');
    state = movePlayer(state, 'right');

    expect(state.playerLane).toBe(3);
  });

  it('increases score and speed as time passes', () => {
    const state = updateGame(startGame(), 16_500, () => 1);

    expect(state.score).toBe(165);
    expect(state.speedLevel).toBe(3);
    expect(calculateStepMs(1)).toBe(520);
  });

  it('spawns and advances incoming road objects by timed steps', () => {
    const randomValues = [0, 0.2, 0.9];
    const state = updateGame(startGame(), 620, () => randomValues.shift() ?? 1);

    expect(state.objects).toHaveLength(1);
    expect(state.objects[0]).toMatchObject({
      lane: 0,
      row: 0,
      kind: 'barrier'
    });
  });

  it('ends the game when an object reaches the player lane', () => {
    const state = runningState({
      playerLane: 2,
      objects: [{ id: 7, lane: 2, row: playerRow - 1, kind: 'car' }]
    });
    const result = updateGame(state, 620, () => 1);

    expect(roadRows).toBe(12);
    expect(result.phase).toBe('game-over');
    expect(result.crashedObjectId).toBe(7);
  });
});
