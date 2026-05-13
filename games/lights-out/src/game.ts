export type DifficultyId = 'easy' | 'normal' | 'hard';
export type LightBoard = readonly boolean[];
export type RandomSource = () => number;

export interface Difficulty {
  readonly id: DifficultyId;
  readonly label: string;
  readonly size: number;
  readonly toggleCount: number;
  readonly scoreBase: number;
  readonly timeBonus: number;
  readonly movePenalty: number;
  readonly roundTimeSeconds: number;
  readonly minRoundTimeSeconds: number;
}

export interface PuzzleState {
  readonly difficulty: Difficulty;
  readonly board: LightBoard;
  readonly solutionMoves: readonly number[];
  readonly round: number;
  readonly score: number;
  readonly failures: number;
  readonly moves: number;
  readonly elapsedSeconds: number;
  readonly remainingSeconds: number;
  readonly roundTimeSeconds: number;
}

export interface RoundScoreInput {
  readonly difficultyId: DifficultyId;
  readonly round: number;
  readonly remainingSeconds: number;
  readonly moves: number;
}

export const DIFFICULTIES: readonly Difficulty[] = [
  {
    id: 'easy',
    label: 'Easy',
    size: 3,
    toggleCount: 6,
    scoreBase: 2_500,
    timeBonus: 8,
    movePenalty: 35,
    roundTimeSeconds: 140,
    minRoundTimeSeconds: 90,
  },
  {
    id: 'normal',
    label: 'Normal',
    size: 5,
    toggleCount: 14,
    scoreBase: 5_500,
    timeBonus: 10,
    movePenalty: 45,
    roundTimeSeconds: 220,
    minRoundTimeSeconds: 140,
  },
  {
    id: 'hard',
    label: 'Hard',
    size: 7,
    toggleCount: 28,
    scoreBase: 9_500,
    timeBonus: 12,
    movePenalty: 55,
    roundTimeSeconds: 320,
    minRoundTimeSeconds: 200,
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
  round = 1,
  score = 0,
  failures = 0,
): PuzzleState {
  const difficulty = getDifficulty(difficultyId);
  const solutionMoves = chooseUniqueIndexes(difficulty.size * difficulty.size, difficulty.toggleCount, random);
  let board = createSolvedBoard(difficulty.size);
  const safeRound = Math.max(1, Math.floor(round));
  const roundTimeSeconds = getRoundTimeSeconds(difficulty, safeRound);

  for (const index of solutionMoves) {
    board = toggleAt(board, difficulty.size, index);
  }

  if (isSolved(board)) {
    board = toggleAt(board, difficulty.size, 0);
    return {
      difficulty,
      board,
      solutionMoves: [0],
      round: safeRound,
      score,
      failures,
      moves: 0,
      elapsedSeconds: 0,
      remainingSeconds: roundTimeSeconds,
      roundTimeSeconds,
    };
  }

  return {
    difficulty,
    board,
    solutionMoves,
    round: safeRound,
    score,
    failures,
    moves: 0,
    elapsedSeconds: 0,
    remainingSeconds: roundTimeSeconds,
    roundTimeSeconds,
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
  const safeElapsedSeconds = Math.max(0, elapsedSeconds);

  return {
    ...state,
    elapsedSeconds: state.elapsedSeconds + safeElapsedSeconds,
    remainingSeconds: Math.max(0, state.remainingSeconds - safeElapsedSeconds),
  };
}

export function advanceRound(state: PuzzleState, random: RandomSource = Math.random): PuzzleState {
  const roundScore = calculateRoundScore({
    difficultyId: state.difficulty.id,
    round: state.round,
    remainingSeconds: state.remainingSeconds,
    moves: state.moves,
  });

  return createPuzzleState(
    state.difficulty.id,
    random,
    state.round + 1,
    state.score + roundScore,
    state.failures,
  );
}

export function recordFailure(state: PuzzleState): PuzzleState {
  return {
    ...state,
    failures: state.failures + 1,
    remainingSeconds: 0,
  };
}

export function isTimedOut(state: PuzzleState): boolean {
  return state.remainingSeconds <= 0;
}

export function calculateRoundScore(input: RoundScoreInput): number {
  const difficulty = getDifficulty(input.difficultyId);
  const rawScore = difficulty.scoreBase
    + input.round * 120
    + Math.floor(input.remainingSeconds) * difficulty.timeBonus
    - input.moves * difficulty.movePenalty;

  return Math.max(100, rawScore);
}

export function getRoundTimeSeconds(difficulty: Difficulty, round: number): number {
  const safeRound = Math.max(1, Math.floor(round));

  return Math.max(difficulty.minRoundTimeSeconds, difficulty.roundTimeSeconds - (safeRound - 1) * 5);
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
