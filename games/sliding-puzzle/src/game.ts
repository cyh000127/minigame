export type DifficultyId = 'easy' | 'normal' | 'hard';
export type SlidingBoard = readonly number[];
export type RandomSource = () => number;
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Difficulty {
  readonly id: DifficultyId;
  readonly label: string;
  readonly size: number;
  readonly shuffleMoves: number;
  readonly scoreBase: number;
  readonly timePenalty: number;
  readonly movePenalty: number;
}

export interface PuzzleState {
  readonly difficulty: Difficulty;
  readonly board: SlidingBoard;
  readonly moves: number;
  readonly elapsedSeconds: number;
}

export interface ScoreInput {
  readonly difficultyId: DifficultyId;
  readonly elapsedSeconds: number;
  readonly moves: number;
}

export const EMPTY = 0;

export const DIFFICULTIES: readonly Difficulty[] = [
  {
    id: 'easy',
    label: 'Easy',
    size: 3,
    shuffleMoves: 60,
    scoreBase: 3_000,
    timePenalty: 5,
    movePenalty: 18,
  },
  {
    id: 'normal',
    label: 'Normal',
    size: 4,
    shuffleMoves: 130,
    scoreBase: 6_500,
    timePenalty: 6,
    movePenalty: 24,
  },
  {
    id: 'hard',
    label: 'Hard',
    size: 5,
    shuffleMoves: 240,
    scoreBase: 11_000,
    timePenalty: 8,
    movePenalty: 30,
  },
] as const;

export function getDifficulty(id: DifficultyId): Difficulty {
  const difficulty = DIFFICULTIES.find((entry) => entry.id === id);

  if (!difficulty) {
    throw new Error(`Unknown difficulty: ${id}`);
  }

  return difficulty;
}

export function createSolvedBoard(size: number): SlidingBoard {
  return Array.from({ length: size * size }, (_, index) => {
    const value = index + 1;
    return value === size * size ? EMPTY : value;
  });
}

export function createPuzzleState(
  difficultyId: DifficultyId = 'easy',
  random: RandomSource = Math.random,
): PuzzleState {
  const difficulty = getDifficulty(difficultyId);

  return {
    difficulty,
    board: shuffleBoard(difficulty, random),
    moves: 0,
    elapsedSeconds: 0,
  };
}

export function shuffleBoard(difficulty: Difficulty, random: RandomSource = Math.random): SlidingBoard {
  let board = createSolvedBoard(difficulty.size);
  let previousEmptyIndex = -1;

  for (let step = 0; step < difficulty.shuffleMoves; step += 1) {
    const emptyIndex = getEmptyIndex(board);
    const movableIndexes = getMovableIndexes(board, difficulty.size).filter((index) => index !== previousEmptyIndex);
    const candidates = movableIndexes.length > 0 ? movableIndexes : getMovableIndexes(board, difficulty.size);
    const nextIndex = candidates[Math.floor(random() * candidates.length)] ?? candidates[0];

    if (nextIndex === undefined) {
      continue;
    }

    previousEmptyIndex = emptyIndex;
    board = moveTile(board, difficulty.size, nextIndex);
  }

  if (isSolved(board)) {
    const nextIndex = getMovableIndexes(board, difficulty.size)[0];

    if (nextIndex !== undefined) {
      board = moveTile(board, difficulty.size, nextIndex);
    }
  }

  return board;
}

export function moveTile(board: SlidingBoard, size: number, tileIndex: number): SlidingBoard {
  const emptyIndex = getEmptyIndex(board);

  if (!isAdjacent(tileIndex, emptyIndex, size)) {
    return board;
  }

  const nextBoard = [...board];
  nextBoard[emptyIndex] = board[tileIndex] ?? EMPTY;
  nextBoard[tileIndex] = EMPTY;

  return nextBoard;
}

export function moveByDirection(board: SlidingBoard, size: number, direction: Direction): SlidingBoard {
  const emptyIndex = getEmptyIndex(board);
  const row = getRow(emptyIndex, size);
  const column = getColumn(emptyIndex, size);
  const targetIndex = getDirectionTargetIndex(direction, row, column, size);

  return targetIndex === null ? board : moveTile(board, size, targetIndex);
}

export function getMovableIndexes(board: SlidingBoard, size: number): readonly number[] {
  const emptyIndex = getEmptyIndex(board);
  const row = getRow(emptyIndex, size);
  const column = getColumn(emptyIndex, size);
  const indexes: number[] = [];

  if (row > 0) {
    indexes.push(emptyIndex - size);
  }

  if (row < size - 1) {
    indexes.push(emptyIndex + size);
  }

  if (column > 0) {
    indexes.push(emptyIndex - 1);
  }

  if (column < size - 1) {
    indexes.push(emptyIndex + 1);
  }

  return indexes;
}

export function isSolved(board: SlidingBoard): boolean {
  return board.every((value, index) => {
    const expected = index === board.length - 1 ? EMPTY : index + 1;
    return value === expected;
  });
}

export function isSolvable(board: SlidingBoard, size: number): boolean {
  const inversions = countInversions(board);

  if (size % 2 === 1) {
    return inversions % 2 === 0;
  }

  const emptyRowFromBottom = size - getRow(getEmptyIndex(board), size);
  return emptyRowFromBottom % 2 === 0 ? inversions % 2 === 1 : inversions % 2 === 0;
}

export function tickTimer(state: PuzzleState, elapsedSeconds: number): PuzzleState {
  return {
    ...state,
    elapsedSeconds: state.elapsedSeconds + Math.max(0, elapsedSeconds),
  };
}

export function calculateScore(input: ScoreInput): number {
  const difficulty = getDifficulty(input.difficultyId);
  const penalty = input.elapsedSeconds * difficulty.timePenalty + input.moves * difficulty.movePenalty;

  return Math.max(100, difficulty.scoreBase - penalty);
}

export function getEmptyIndex(board: SlidingBoard): number {
  const index = board.indexOf(EMPTY);

  if (index < 0) {
    throw new Error('Sliding board must contain an empty tile.');
  }

  return index;
}

export function getRow(index: number, size: number): number {
  return Math.floor(index / size);
}

export function getColumn(index: number, size: number): number {
  return index % size;
}

function isAdjacent(index: number, otherIndex: number, size: number): boolean {
  const row = getRow(index, size);
  const column = getColumn(index, size);
  const otherRow = getRow(otherIndex, size);
  const otherColumn = getColumn(otherIndex, size);

  return Math.abs(row - otherRow) + Math.abs(column - otherColumn) === 1;
}

function getDirectionTargetIndex(direction: Direction, emptyRow: number, emptyColumn: number, size: number): number | null {
  if (direction === 'up' && emptyRow > 0) {
    return (emptyRow - 1) * size + emptyColumn;
  }

  if (direction === 'down' && emptyRow < size - 1) {
    return (emptyRow + 1) * size + emptyColumn;
  }

  if (direction === 'left' && emptyColumn > 0) {
    return emptyRow * size + emptyColumn - 1;
  }

  if (direction === 'right' && emptyColumn < size - 1) {
    return emptyRow * size + emptyColumn + 1;
  }

  return null;
}

function countInversions(board: SlidingBoard): number {
  const values = board.filter((value) => value !== EMPTY);
  let inversions = 0;

  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      const leftValue = values[left];
      const rightValue = values[right];

      if (leftValue !== undefined && rightValue !== undefined && leftValue > rightValue) {
        inversions += 1;
      }
    }
  }

  return inversions;
}
