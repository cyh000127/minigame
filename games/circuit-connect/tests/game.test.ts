import { describe, expect, it } from 'vitest';
import {
  EAST,
  NORTH,
  SOUTH,
  WEST,
  advanceRound,
  calculateRoundScore,
  countActiveCells,
  createCellKey,
  createInitialState,
  createSeededRandom,
  createSolutionBoard,
  formatTime,
  getRoundTimeSeconds,
  getPoweredKeys,
  isSolved,
  isTimedOut,
  recordFailure,
  rotateCell,
  rotateMask,
  tickTimer,
  type CircuitBoard,
} from '../src/game';

describe('Circuit Connect rules', () => {
  it('rotates a bit-mask clockwise and returns to the original after four turns', () => {
    const elbow = NORTH | EAST;

    expect(rotateMask(elbow)).toBe(EAST | SOUTH);
    expect(rotateMask(elbow, 4)).toBe(elbow);
    expect(rotateMask(WEST, 1)).toBe(NORTH);
  });

  it('creates deterministic puzzles from the same seed', () => {
    const first = createInitialState('normal', 135);
    const second = createInitialState('normal', 135);

    expect(first.board).toEqual(second.board);
    expect(first.seed).toBe(135);
    expect(first.difficulty.size).toBe(5);
    expect(first.round).toBe(1);
    expect(first.score).toBe(0);
    expect(first.remainingSeconds).toBe(first.difficulty.roundTimeSeconds);
  });

  it('generates a solvable puzzle by keeping a solution mask for every active cell', () => {
    const state = createInitialState('hard', 2468);
    const solutionBoard = createSolutionBoard(state.board);
    const solvedState = {
      ...state,
      board: solutionBoard,
    };

    expect(countActiveCells(state.board)).toBeGreaterThanOrEqual(state.difficulty.size * 2 - 1);
    expect(isSolved(solvedState)).toBe(true);
  });

  it('does not start already solved', () => {
    const state = createInitialState('easy', 1);

    expect(isSolved(state)).toBe(false);
  });

  it('rotates active cells and counts moves immutably', () => {
    const state = createInitialState('easy', 777);
    const activeCell = state.board.flat().find((cell) => cell.solutionMask !== 0);

    expect(activeCell).toBeDefined();

    const nextState = rotateCell(state, activeCell?.row ?? 0, activeCell?.col ?? 0);

    expect(nextState).not.toBe(state);
    expect(nextState.moves).toBe(1);
  });

  it('ignores rotation requests on empty or outside cells', () => {
    const state = createInitialState('easy', 888);
    const emptyCell = state.board.flat().find((cell) => cell.solutionMask === 0);

    if (emptyCell) {
      expect(rotateCell(state, emptyCell.row, emptyCell.col)).toBe(state);
    }

    expect(rotateCell(state, 99, 99)).toBe(state);
  });

  it('powers cells only through mutual connections', () => {
    const board: CircuitBoard = [
      [
        { row: 0, col: 0, mask: EAST, solutionMask: EAST, isSource: true, isGoal: false },
        { row: 0, col: 1, mask: WEST | SOUTH, solutionMask: WEST | SOUTH, isSource: false, isGoal: false },
      ],
      [
        { row: 1, col: 0, mask: EAST, solutionMask: EAST, isSource: false, isGoal: false },
        { row: 1, col: 1, mask: NORTH, solutionMask: NORTH, isSource: false, isGoal: true },
      ],
    ];

    expect(getPoweredKeys(board)).toEqual(new Set([
      createCellKey(0, 0),
      createCellKey(0, 1),
      createCellKey(1, 1),
    ]));
  });

  it('counts down time while tracking elapsed time', () => {
    const state = tickTimer(createInitialState('normal', 333), 10);

    expect(state.elapsedSeconds).toBe(10);
    expect(state.remainingSeconds).toBe(state.roundTimeSeconds - 10);
    expect(formatTime(state.remainingSeconds)).toBe('0:52');
  });

  it('scores cleared rounds from remaining time, active cells and moves', () => {
    const state = createInitialState('normal', 333);
    const score = calculateRoundScore({
      difficultyId: 'normal',
      round: state.round,
      moves: 10,
      remainingSeconds: 20,
      activeCells: countActiveCells(state.board),
    });

    expect(score).toBeGreaterThan(8500);
  });

  it('advances to a fresh timed board after a clear', () => {
    const state = createInitialState('easy', 123);
    const nextState = advanceRound({ ...state, board: createSolutionBoard(state.board), moves: 8, remainingSeconds: 20 }, 456);

    expect(nextState.round).toBe(2);
    expect(nextState.score).toBeGreaterThan(0);
    expect(nextState.moves).toBe(0);
    expect(nextState.remainingSeconds).toBe(getRoundTimeSeconds(nextState.difficulty, 2));
    expect(nextState.board).not.toEqual(state.board);
  });

  it('records a failed run when the round timer reaches zero', () => {
    const timedOutState = tickTimer(createInitialState('hard', 987), 999);
    const failedState = recordFailure(timedOutState);

    expect(isTimedOut(timedOutState)).toBe(true);
    expect(failedState.failures).toBe(1);
    expect(failedState.remainingSeconds).toBe(0);
  });

  it('returns stable pseudo-random values between zero and one', () => {
    const random = createSeededRandom(42);
    const values = [random(), random(), random()];

    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(values).toEqual([0.2523451747838408, 0.08812504541128874, 0.5772811982315034]);
  });
});
