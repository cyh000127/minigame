export type DifficultyId = 'easy' | 'normal' | 'hard';
export type LightBoard = readonly boolean[];
export type RandomSource = () => number;

export interface Difficulty {
  readonly id: DifficultyId;
  readonly label: string;
  readonly size: number;
  readonly toggleCount: number;
  readonly scoreBase: number;
  readonly timePenalty: number;
  readonly movePenalty: number;
}

export interface PuzzleState {
  readonly difficulty: Difficulty;
  readonly board: LightBoard;
  readonly solutionMoves: readonly number[];
  readonly moves: number;
  readonly elapsedSeconds: number;
}

export interface ScoreInput {
  readonly difficultyId: DifficultyId;
  readonly elapsedSeconds: number;
  readonly moves: number;
}

export const DIFFICULTIES: readonly Difficulty[] = [
  {
    id: 'easy',
    label: 'Easy',
    size: 3,
    toggleCount: 6,
    scoreBase: 2_500,
    timePenalty: 5,
    movePenalty: 35,
  },
  {
    id: 'normal',
    label: 'Normal',
    size: 5,
    toggleCount: 14,
    scoreBase: 5_500,
    timePenalty: 7,
    movePenalty: 45,
  },
  {
    id: 'hard',
    label: 'Hard',
    size: 7,
    toggleCount: 28,
    scoreBase: 9_500,
    timePenalty: 9,
    movePenalty: 55,
  },
] as const;

export function getDifficulty(id: DifficultyId): Difficulty {
  const difficulty = DIFFICULTIES.find((entry) => entry.id === id);

  if (!difficulty) {
    throw new Error(`Unknown difficulty: ${id}`);
  }

  return difficulty;
}

export function createSolvedBoard(size: number): LightBoard {
  return Array.from({ length: size * size }, () => false);
}

export function createPuzzleState(
  difficultyId: DifficultyId = 'easy',
  random: RandomSource = Math.random,
): PuzzleState {
  const difficulty = getDifficulty(difficultyId);
  const solutionMoves = chooseUniqueIndexes(difficulty.size * difficulty.size, difficulty.toggleCount, random);
  let board = createSolvedBoard(difficulty.size);

  for (const index of solutionMoves) {
    board = toggleAt(board, difficulty.size, index);
  }

  if (isSolved(board)) {
    board = toggleAt(board, difficulty.size, 0);
    return {
      difficulty,
      board,
      solutionMoves: [0],
      moves: 0,
      elapsedSeconds: 0,
    };
  }

  return {
    difficulty,
    board,
    solutionMoves,
    moves: 0,
    elapsedSeconds: 0,
  };
}

export function toggleAt(board: LightBoard, size: number, index: number): LightBoard {
  if (index < 0 || index >= board.length) {
    return board;
  }

  const toggleIndexes = new Set(getToggleIndexes(size, index));

  return board.map((isOn, cellIndex) => (toggleIndexes.has(cellIndex) ? !isOn : isOn));
}

export function getToggleIndexes(size: number, index: number): readonly number[] {
  const row = getRow(index, size);
  const column = getColumn(index, size);
  const indexes = [index];

  if (row > 0) {
    indexes.push(index - size);
  }

  if (row < size - 1) {
    indexes.push(index + size);
  }

  if (column > 0) {
    indexes.push(index - 1);
  }

  if (column < size - 1) {
    indexes.push(index + 1);
  }

  return indexes.sort((left, right) => left - right);
}

export function isSolved(board: LightBoard): boolean {
  return board.every((isOn) => !isOn);
}

export function countLightsOn(board: LightBoard): number {
  return board.filter(Boolean).length;
}

export function applyMoves(board: LightBoard, size: number, moves: readonly number[]): LightBoard {
  return moves.reduce((nextBoard, index) => toggleAt(nextBoard, size, index), board);
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

export function getRow(index: number, size: number): number {
  return Math.floor(index / size);
}

export function getColumn(index: number, size: number): number {
  return index % size;
}

function chooseUniqueIndexes(count: number, pickCount: number, random: RandomSource): readonly number[] {
  const indexes = Array.from({ length: count }, (_, index) => index);

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = indexes[index];
    const swap = indexes[swapIndex];

    if (current === undefined || swap === undefined) {
      continue;
    }

    indexes[index] = swap;
    indexes[swapIndex] = current;
  }

  return indexes.slice(0, Math.min(pickCount, count));
}
