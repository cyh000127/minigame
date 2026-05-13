export type DifficultyId = 'easy' | 'normal' | 'hard';
export type SudokuBoard = readonly number[];
export type RandomSource = () => number;

export interface Difficulty {
  readonly id: DifficultyId;
  readonly label: string;
  readonly givenCount: number;
  readonly scoreBase: number;
  readonly timePenalty: number;
}

export interface SudokuPuzzle {
  readonly difficulty: Difficulty;
  readonly puzzle: SudokuBoard;
  readonly solution: SudokuBoard;
  readonly givenIndexes: ReadonlySet<number>;
}

export interface ScoreInput {
  readonly difficultyId: DifficultyId;
  readonly elapsedSeconds: number;
  readonly mistakes: number;
  readonly hints: number;
}

export const BOARD_SIZE = 9;
export const BOX_SIZE = 3;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const EMPTY = 0;

export const DIFFICULTIES: readonly Difficulty[] = [
  {
    id: 'easy',
    label: 'Easy',
    givenCount: 40,
    scoreBase: 4_000,
    timePenalty: 6,
  },
  {
    id: 'normal',
    label: 'Normal',
    givenCount: 34,
    scoreBase: 7_000,
    timePenalty: 8,
  },
  {
    id: 'hard',
    label: 'Hard',
    givenCount: 30,
    scoreBase: 11_000,
    timePenalty: 10,
  },
] as const;

export function getDifficulty(id: DifficultyId): Difficulty {
  const difficulty = DIFFICULTIES.find((entry) => entry.id === id);

  if (!difficulty) {
    throw new Error(`Unknown difficulty: ${id}`);
  }

  return difficulty;
}

export function generatePuzzle(
  difficultyId: DifficultyId = 'easy',
  random: RandomSource = Math.random,
): SudokuPuzzle {
  const difficulty = getDifficulty(difficultyId);
  const solution = createSolvedBoard(random);
  const puzzle = [...solution];
  let currentGivenCount = CELL_COUNT;

  for (const index of shuffle(createIndexList(), random)) {
    if (currentGivenCount <= difficulty.givenCount) {
      break;
    }

    const value = puzzle[index] ?? EMPTY;

    if (value === EMPTY) {
      continue;
    }

    puzzle[index] = EMPTY;

    if (countSolutions(puzzle) !== 1) {
      puzzle[index] = value;
      continue;
    }

    currentGivenCount -= 1;
  }

  return {
    difficulty,
    puzzle,
    solution,
    givenIndexes: getGivenIndexes(puzzle),
  };
}

export function createSolvedBoard(random: RandomSource = Math.random): SudokuBoard {
  const rows = shuffleBandsAndLines(random);
  const columns = shuffleBandsAndLines(random);
  const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);

  return rows.flatMap((row) =>
    columns.map((column) => {
      const numberIndex = (BOX_SIZE * (row % BOX_SIZE) + Math.floor(row / BOX_SIZE) + column) % BOARD_SIZE;
      return numbers[numberIndex] ?? 1;
    }),
  );
}

export function countSolutions(board: SudokuBoard, limit = 2): number {
  const workingBoard = [...board];

  function solve(solutionCount: number): number {
    if (solutionCount >= limit) {
      return solutionCount;
    }

    const next = findEmptyCellWithFewestCandidates(workingBoard);

    if (!next) {
      return solutionCount + 1;
    }

    const [index, candidates] = next;

    for (const candidate of candidates) {
      workingBoard[index] = candidate;
      solutionCount = solve(solutionCount);
      workingBoard[index] = EMPTY;

      if (solutionCount >= limit) {
        return solutionCount;
      }
    }

    return solutionCount;
  }

  return solve(0);
}

export function getCandidates(board: SudokuBoard, index: number): readonly number[] {
  if (index < 0 || index >= CELL_COUNT || board[index] !== EMPTY) {
    return [];
  }

  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((value) => canPlaceValue(board, index, value));
}

export function canPlaceValue(board: SudokuBoard, index: number, value: number): boolean {
  if (value < 1 || value > 9 || !Number.isInteger(value)) {
    return false;
  }

  const row = getRow(index);
  const column = getColumn(index);
  const boxStartRow = row - (row % BOX_SIZE);
  const boxStartColumn = column - (column % BOX_SIZE);

  for (let nextColumn = 0; nextColumn < BOARD_SIZE; nextColumn += 1) {
    const peerIndex = row * BOARD_SIZE + nextColumn;

    if (peerIndex !== index && board[peerIndex] === value) {
      return false;
    }
  }

  for (let nextRow = 0; nextRow < BOARD_SIZE; nextRow += 1) {
    const peerIndex = nextRow * BOARD_SIZE + column;

    if (peerIndex !== index && board[peerIndex] === value) {
      return false;
    }
  }

  for (let rowOffset = 0; rowOffset < BOX_SIZE; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < BOX_SIZE; columnOffset += 1) {
      const peerIndex = (boxStartRow + rowOffset) * BOARD_SIZE + boxStartColumn + columnOffset;

      if (peerIndex !== index && board[peerIndex] === value) {
        return false;
      }
    }
  }

  return true;
}

export function isSolvedBoard(board: SudokuBoard, solution: SudokuBoard): boolean {
  return board.length === CELL_COUNT && board.every((value, index) => value === solution[index]);
}

export function getConflictingIndexes(board: SudokuBoard): ReadonlySet<number> {
  const conflicts = new Set<number>();

  for (let index = 0; index < CELL_COUNT; index += 1) {
    const value = board[index] ?? EMPTY;

    if (value === EMPTY) {
      continue;
    }

    const peerIndexes = getPeerIndexes(index);

    if (peerIndexes.some((peerIndex) => board[peerIndex] === value)) {
      conflicts.add(index);

      for (const peerIndex of peerIndexes) {
        if (board[peerIndex] === value) {
          conflicts.add(peerIndex);
        }
      }
    }
  }

  return conflicts;
}

export function calculateScore(input: ScoreInput): number {
  const difficulty = getDifficulty(input.difficultyId);
  const penalty = input.elapsedSeconds * difficulty.timePenalty + input.mistakes * 350 + input.hints * 700;

  return Math.max(100, difficulty.scoreBase - penalty);
}

export function getGivenIndexes(board: SudokuBoard): ReadonlySet<number> {
  return new Set(
    board
      .map((value, index) => (value === EMPTY ? -1 : index))
      .filter((index) => index >= 0),
  );
}

export function getPeerIndexes(index: number): readonly number[] {
  const peers = new Set<number>();
  const row = getRow(index);
  const column = getColumn(index);
  const boxStartRow = row - (row % BOX_SIZE);
  const boxStartColumn = column - (column % BOX_SIZE);

  for (let nextColumn = 0; nextColumn < BOARD_SIZE; nextColumn += 1) {
    peers.add(row * BOARD_SIZE + nextColumn);
  }

  for (let nextRow = 0; nextRow < BOARD_SIZE; nextRow += 1) {
    peers.add(nextRow * BOARD_SIZE + column);
  }

  for (let rowOffset = 0; rowOffset < BOX_SIZE; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < BOX_SIZE; columnOffset += 1) {
      peers.add((boxStartRow + rowOffset) * BOARD_SIZE + boxStartColumn + columnOffset);
    }
  }

  peers.delete(index);
  return [...peers].sort((left, right) => left - right);
}

export function getRow(index: number): number {
  return Math.floor(index / BOARD_SIZE);
}

export function getColumn(index: number): number {
  return index % BOARD_SIZE;
}

function findEmptyCellWithFewestCandidates(board: number[]): readonly [number, readonly number[]] | null {
  let bestIndex = -1;
  let bestCandidates: readonly number[] | null = null;

  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (board[index] !== EMPTY) {
      continue;
    }

    const candidates = getCandidates(board, index);

    if (candidates.length === 0) {
      return [index, []];
    }

    if (!bestCandidates || candidates.length < bestCandidates.length) {
      bestIndex = index;
      bestCandidates = candidates;
    }
  }

  return bestCandidates ? [bestIndex, bestCandidates] : null;
}

function shuffleBandsAndLines(random: RandomSource): readonly number[] {
  return shuffle([0, 1, 2], random).flatMap((band) =>
    shuffle([0, 1, 2], random).map((line) => band * BOX_SIZE + line),
  );
}

function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = result[index];
    const swap = result[swapIndex];

    if (current === undefined || swap === undefined) {
      continue;
    }

    result[index] = swap;
    result[swapIndex] = current;
  }

  return result;
}

function createIndexList(): readonly number[] {
  return Array.from({ length: CELL_COUNT }, (_, index) => index);
}
