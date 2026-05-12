import { describe, expect, it } from 'vitest';
import {
  applyMove,
  canMove,
  continueAfterWin,
  createEmptyBoard,
  createGameState,
  getEmptyIndexes,
  moveBoard,
  slideLine,
  spawnRandomTile,
  type Board,
  type RandomSource,
} from './game';

function sequenceRandom(values: readonly number[]): RandomSource {
  let index = 0;

  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

describe('2048 engine', () => {
  it('slides and merges a line once per tile', () => {
    expect(slideLine([2, 2, 2, 0])).toEqual({
      values: [4, 2, 0, 0],
      scoreGain: 4,
    });

    expect(slideLine([2, 2, 4, 4])).toEqual({
      values: [4, 8, 0, 0],
      scoreGain: 12,
    });
  });

  it('moves a board to the left and reports score gain', () => {
    const board: Board = [
      2, 2, 4, 0,
      0, 2, 2, 2,
      4, 0, 4, 4,
      0, 0, 0, 0,
    ];

    const result = moveBoard(board, 'left');

    expect(result.board).toEqual([
      4, 4, 0, 0,
      4, 2, 0, 0,
      8, 4, 0, 0,
      0, 0, 0, 0,
    ]);
    expect(result.scoreGain).toBe(16);
    expect(result.moved).toBe(true);
  });

  it('moves a board to the right', () => {
    const board: Board = [
      2, 2, 0, 0,
      4, 0, 4, 4,
      0, 0, 0, 0,
      2, 0, 2, 2,
    ];

    expect(moveBoard(board, 'right').board).toEqual([
      0, 0, 0, 4,
      0, 0, 4, 8,
      0, 0, 0, 0,
      0, 0, 2, 4,
    ]);
  });

  it('moves a board vertically', () => {
    const board: Board = [
      2, 0, 2, 4,
      2, 4, 2, 4,
      4, 4, 0, 0,
      0, 0, 0, 0,
    ];

    expect(moveBoard(board, 'up').board).toEqual([
      4, 8, 4, 8,
      4, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
    expect(moveBoard(board, 'down').board).toEqual([
      0, 0, 0, 0,
      0, 0, 0, 0,
      4, 0, 0, 0,
      4, 8, 4, 8,
    ]);
  });

  it('spawns deterministic tiles on empty cells', () => {
    const board = spawnRandomTile(createEmptyBoard(), sequenceRandom([0, 0.95]));

    expect(board[0]).toBe(4);
    expect(getEmptyIndexes(board)).toHaveLength(15);
  });

  it('creates a game with two starting tiles', () => {
    const state = createGameState(sequenceRandom([0, 0, 0, 0]));

    expect(getEmptyIndexes(state.board)).toHaveLength(14);
    expect(state.score).toBe(0);
    expect(state.status).toBe('playing');
  });

  it('does not spawn a tile when the board cannot move in that direction', () => {
    const state = {
      board: [
        2, 4, 8, 16,
        32, 64, 128, 256,
        512, 1024, 2, 4,
        8, 16, 32, 64,
      ],
      score: 10,
      bestScore: 10,
      status: 'playing' as const,
      hasWon: false,
      moveCount: 0,
      targetTile: 2048,
    };

    expect(applyMove(state, 'left', sequenceRandom([0, 0]))).toBe(state);
  });

  it('detects game over when there are no empty cells or merges', () => {
    const board: Board = [
      2, 4, 2, 4,
      4, 2, 4, 2,
      2, 4, 2, 4,
      4, 2, 4, 2,
    ];

    expect(canMove(board)).toBe(false);
  });

  it('enters won state when 2048 is created and can continue after win', () => {
    const state = {
      board: [
        1024, 1024, 0, 0,
        2, 4, 8, 16,
        32, 64, 128, 256,
        0, 0, 0, 0,
      ],
      score: 0,
      bestScore: 0,
      status: 'playing' as const,
      hasWon: false,
      moveCount: 0,
      targetTile: 2048,
    };

    const wonState = applyMove(state, 'left', sequenceRandom([0.9, 0]));

    expect(wonState.status).toBe('won');
    expect(wonState.hasWon).toBe(true);
    expect(wonState.score).toBe(2048);
    expect(continueAfterWin(wonState).status).toBe('playing');
  });

  it('uses the selected target tile for win detection', () => {
    const state = {
      board: [
        512, 512, 0, 0,
        2, 4, 8, 16,
        32, 64, 128, 256,
        0, 0, 0, 0,
      ],
      score: 0,
      bestScore: 0,
      status: 'playing' as const,
      hasWon: false,
      moveCount: 0,
      targetTile: 1024,
    };

    expect(applyMove(state, 'left', sequenceRandom([0.9, 0])).status).toBe('won');
  });
});
