import { describe, expect, it } from 'vitest';
import {
  calculateScore,
  canMove,
  choosePeg,
  createInitialState,
  formatTime,
  getLegalDestinations,
  getMinimumMoves,
  isSolved,
  moveDisc,
  tickTimer,
  type HanoiState,
} from '../src/game';

describe('Tower of Hanoi rules', () => {
  it('creates a sorted source peg and tracks the minimum move count', () => {
    const state = createInitialState('easy');

    expect(state.pegs).toEqual([[3, 2, 1], [], []]);
    expect(getMinimumMoves(state.difficulty.discCount)).toBe(7);
  });

  it('allows a smaller top disc to move onto an empty or larger target peg', () => {
    const state = createInitialState('easy');

    expect(canMove(state.pegs, 0, 1)).toBe(true);

    const moved = moveDisc(state, 0, 1);

    expect(moved.pegs).toEqual([[3, 2], [1], []]);
    expect(moved.moves).toBe(1);
  });

  it('blocks moving a larger disc onto a smaller target disc', () => {
    const state = {
      ...createInitialState('easy'),
      pegs: [[3], [2, 1], []],
    } satisfies HanoiState;

    expect(canMove(state.pegs, 0, 1)).toBe(false);
    expect(moveDisc(state, 0, 1)).toBe(state);
  });

  it('returns legal destination pegs for a selected source', () => {
    const state = {
      ...createInitialState('easy'),
      pegs: [[3, 2], [1], []],
    } satisfies HanoiState;

    expect(getLegalDestinations(state.pegs, 0)).toEqual([2]);
    expect(getLegalDestinations(state.pegs, 1)).toEqual([0, 2]);
  });

  it('solves the easy puzzle in the optimal sequence', () => {
    let state = createInitialState('easy');

    for (const [fromPeg, toPeg] of [
      [0, 2],
      [0, 1],
      [2, 1],
      [0, 2],
      [1, 0],
      [1, 2],
      [0, 2],
    ] as const) {
      state = moveDisc(state, fromPeg, toPeg);
    }

    expect(state.moves).toBe(7);
    expect(state.pegs).toEqual([[], [], [3, 2, 1]]);
    expect(isSolved(state)).toBe(true);
  });

  it('selects a peg and clears the selection after a valid move', () => {
    let state = createInitialState('easy');

    state = choosePeg(state, 0);
    expect(state.selectedPeg).toBe(0);

    state = choosePeg(state, 1);
    expect(state.pegs).toEqual([[3, 2], [1], []]);
    expect(state.selectedPeg).toBeNull();
  });

  it('penalizes time and only extra moves beyond the theoretical minimum', () => {
    expect(calculateScore({ difficultyId: 'normal', moves: 15, elapsedSeconds: 0 })).toBe(6500);
    expect(calculateScore({ difficultyId: 'normal', moves: 18, elapsedSeconds: 10 })).toBe(6250);
  });

  it('ticks time immutably and formats seconds as clock text', () => {
    const state = createInitialState('hard');
    const nextState = tickTimer(state, 65);

    expect(nextState).not.toBe(state);
    expect(nextState.elapsedSeconds).toBe(65);
    expect(formatTime(nextState.elapsedSeconds)).toBe('1:05');
  });
});
