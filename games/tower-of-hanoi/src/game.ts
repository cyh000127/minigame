export type DifficultyId = 'easy' | 'normal' | 'hard';
export type PegIndex = 0 | 1 | 2;
export type Pegs = readonly [readonly number[], readonly number[], readonly number[]];

export interface DifficultyConfig {
  readonly id: DifficultyId;
  readonly label: string;
  readonly discCount: number;
  readonly scoreBase: number;
  readonly timePenalty: number;
  readonly extraMovePenalty: number;
}

export interface HanoiState {
  readonly difficulty: DifficultyConfig;
  readonly pegs: Pegs;
  readonly moves: number;
  readonly elapsedSeconds: number;
  readonly selectedPeg: PegIndex | null;
}

export interface ScoreInput {
  readonly difficultyId: DifficultyId;
  readonly moves: number;
  readonly elapsedSeconds: number;
}

export const PEG_INDICES: readonly PegIndex[] = [0, 1, 2] as const;

export const DIFFICULTIES: readonly DifficultyConfig[] = [
  {
    id: 'easy',
    label: 'Easy',
    discCount: 3,
    scoreBase: 3000,
    timePenalty: 5,
    extraMovePenalty: 45,
  },
  {
    id: 'normal',
    label: 'Normal',
    discCount: 4,
    scoreBase: 6500,
    timePenalty: 7,
    extraMovePenalty: 60,
  },
  {
    id: 'hard',
    label: 'Hard',
    discCount: 5,
    scoreBase: 11000,
    timePenalty: 9,
    extraMovePenalty: 80,
  },
] as const;

export function createInitialState(difficultyId: DifficultyId = 'normal'): HanoiState {
  const difficulty = getDifficulty(difficultyId);

  return {
    difficulty,
    pegs: createInitialPegs(difficulty.discCount),
    moves: 0,
    elapsedSeconds: 0,
    selectedPeg: null,
  };
}

export function getDifficulty(difficultyId: DifficultyId): DifficultyConfig {
  const difficulty = DIFFICULTIES.find((entry) => entry.id === difficultyId);

  if (!difficulty) {
    throw new Error(`Unknown difficulty: ${difficultyId}`);
  }

  return difficulty;
}

export function createInitialPegs(discCount: number): Pegs {
  if (!Number.isInteger(discCount) || discCount < 1) {
    throw new Error('discCount must be a positive integer.');
  }

  return [Array.from({ length: discCount }, (_, index) => discCount - index), [], []];
}

export function getMinimumMoves(discCount: number): number {
  if (!Number.isInteger(discCount) || discCount < 1) {
    throw new Error('discCount must be a positive integer.');
  }

  return (2 ** discCount) - 1;
}

export function getTopDisc(peg: readonly number[]): number | undefined {
  return peg[peg.length - 1];
}

export function canMove(pegs: Pegs, fromPeg: PegIndex, toPeg: PegIndex): boolean {
  if (fromPeg === toPeg) {
    return false;
  }

  const movingDisc = getTopDisc(pegs[fromPeg]);
  const targetDisc = getTopDisc(pegs[toPeg]);

  return movingDisc !== undefined && (targetDisc === undefined || movingDisc < targetDisc);
}

export function getLegalDestinations(pegs: Pegs, fromPeg: PegIndex): readonly PegIndex[] {
  return PEG_INDICES.filter((toPeg) => canMove(pegs, fromPeg, toPeg));
}

export function moveDisc(state: HanoiState, fromPeg: PegIndex, toPeg: PegIndex): HanoiState {
  if (!canMove(state.pegs, fromPeg, toPeg)) {
    return state;
  }

  const nextPegs = clonePegs(state.pegs);
  const movingDisc = nextPegs[fromPeg].pop();

  if (movingDisc === undefined) {
    return state;
  }

  nextPegs[toPeg].push(movingDisc);

  return {
    ...state,
    pegs: nextPegs,
    moves: state.moves + 1,
    selectedPeg: null,
  };
}

export function choosePeg(state: HanoiState, pegIndex: PegIndex): HanoiState {
  if (state.selectedPeg === null) {
    if (getTopDisc(state.pegs[pegIndex]) === undefined) {
      return state;
    }

    return {
      ...state,
      selectedPeg: pegIndex,
    };
  }

  if (state.selectedPeg === pegIndex) {
    return {
      ...state,
      selectedPeg: null,
    };
  }

  return moveDisc(state, state.selectedPeg, pegIndex);
}

export function tickTimer(state: HanoiState, seconds = 1): HanoiState {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return state;
  }

  return {
    ...state,
    elapsedSeconds: state.elapsedSeconds + seconds,
  };
}

export function isSolved(state: HanoiState): boolean {
  const targetPeg = state.pegs[2];

  return (
    targetPeg.length === state.difficulty.discCount
    && targetPeg.every((disc, index) => disc === state.difficulty.discCount - index)
  );
}

export function calculateScore(input: ScoreInput): number {
  const difficulty = getDifficulty(input.difficultyId);
  const minimumMoves = getMinimumMoves(difficulty.discCount);
  const extraMoves = Math.max(0, input.moves - minimumMoves);
  const rawScore = difficulty.scoreBase
    - Math.floor(input.elapsedSeconds) * difficulty.timePenalty
    - extraMoves * difficulty.extraMovePenalty;

  return Math.max(100, rawScore);
}

export function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  return `${minutes}:${restSeconds.toString().padStart(2, '0')}`;
}

function clonePegs(pegs: Pegs): [number[], number[], number[]] {
  return [[...pegs[0]], [...pegs[1]], [...pegs[2]]];
}
