import { describe, expect, it } from 'vitest';
import {
  createGameState,
  createMinedCells,
  getDifficulty,
  getNeighbors,
  getRemainingMines,
  revealCell,
  tickTimer,
  toggleFlag,
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

function cyclingRandom(values: readonly number[]): RandomSource {
  let index = 0;

  return () => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  };
}

describe('Minesweeper engine', () => {
  it('creates an empty ready board for a difficulty', () => {
    const state = createGameState('easy');

    expect(state.cells).toHaveLength(81);
    expect(state.phase).toBe('ready');
    expect(state.firstRevealDone).toBe(false);
    expect(getRemainingMines(state)).toBe(10);
  });

  it('returns valid neighbors without wrapping across rows', () => {
    const difficulty = getDifficulty('easy');

    expect(getNeighbors(0, difficulty)).toEqual([1, 9, 10]);
    expect(getNeighbors(8, difficulty)).toEqual([7, 16, 17]);
    expect(getNeighbors(40, difficulty)).toHaveLength(8);
  });

  it('places mines away from the first clicked cell and its neighbors', () => {
    const difficulty = getDifficulty('easy');
    const cells = createMinedCells(difficulty, 40, sequenceRandom([0]));
    const protectedIndexes = new Set([40, ...getNeighbors(40, difficulty)]);
    const minedIndexes = cells.filter((cell) => cell.hasMine).map((cell) => cell.index);

    expect(minedIndexes).toHaveLength(difficulty.mineCount);
    expect(minedIndexes.some((index) => protectedIndexes.has(index))).toBe(false);
  });

  it('reveals safe cells on first click and starts the game', () => {
    const state = createGameState('easy');
    const next = revealCell(state, 40, cyclingRandom([0, 0.2, 0.4, 0.6, 0.8]));

    expect(next.phase).toBe('playing');
    expect(next.firstRevealDone).toBe(true);
    expect(next.cells[40]?.isRevealed).toBe(true);
    expect(next.cells[40]?.hasMine).toBe(false);
  });

  it('toggles flags and updates remaining mine count', () => {
    const state = createGameState('easy');
    const flagged = toggleFlag(state, 0);
    const unflagged = toggleFlag(flagged, 0);

    expect(flagged.cells[0]?.isFlagged).toBe(true);
    expect(flagged.phase).toBe('playing');
    expect(getRemainingMines(flagged)).toBe(9);
    expect(unflagged.cells[0]?.isFlagged).toBe(false);
    expect(getRemainingMines(unflagged)).toBe(10);
  });

  it('does not reveal a flagged cell', () => {
    const state = toggleFlag(createGameState('easy'), 10);
    const next = revealCell(state, 10, sequenceRandom([0]));

    expect(next).toBe(state);
  });

  it('loses when revealing a mine after the first safe click', () => {
    const started = revealCell(
      createGameState('easy'),
      40,
      cyclingRandom([0, 0.2, 0.4, 0.6, 0.8]),
    );
    const mineIndex = started.cells.find((cell) => cell.hasMine)?.index;

    expect(mineIndex).toBeTypeOf('number');

    const lost = revealCell(started, mineIndex ?? 0);

    expect(lost.phase).toBe('lost');
    expect(lost.cells.filter((cell) => cell.hasMine && cell.isRevealed)).toHaveLength(10);
  });

  it('reveals connected empty cells', () => {
    const state = revealCell(createGameState('easy'), 40, sequenceRandom([0.99]));

    expect(state.revealedCount).toBeGreaterThan(1);
  });

  it('wins when every safe cell is revealed', () => {
    let state = revealCell(createGameState('easy'), 40, sequenceRandom([0]));
    const safeIndexes = state.cells.filter((cell) => !cell.hasMine).map((cell) => cell.index);

    for (const index of safeIndexes) {
      state = revealCell(state, index);
    }

    expect(state.phase).toBe('won');
    expect(state.flagCount).toBe(10);
  });

  it('ticks only while playing', () => {
    const ready = createGameState('easy');
    const playing = revealCell(ready, 40, cyclingRandom([0, 0.2, 0.4, 0.6, 0.8]));

    expect(tickTimer(ready, 10).elapsedSeconds).toBe(0);
    expect(tickTimer(playing, 10).elapsedSeconds).toBe(10);
  });
});
