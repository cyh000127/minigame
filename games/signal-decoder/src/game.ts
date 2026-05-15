export type DifficultyId = 'easy' | 'normal' | 'hard';
export type DirectionId = 'up' | 'right' | 'down' | 'left';

export interface DifficultyConfig {
  readonly id: DifficultyId;
  readonly label: string;
  readonly baseSequenceLength: number;
  readonly baseTimeSeconds: number;
  readonly minTimeSeconds: number;
  readonly strikePenaltySeconds: number;
  readonly scoreBase: number;
  readonly timeBonus: number;
}

export interface StageState {
  readonly difficulty: DifficultyConfig;
  readonly sequence: readonly DirectionId[];
  readonly progressIndex: number;
  readonly remainingSeconds: number;
  readonly stageTimeSeconds: number;
  readonly stage: number;
  readonly score: number;
  readonly strikes: number;
  readonly failures: number;
  readonly seed: number;
}

export interface AnswerResult {
  readonly state: StageState;
  readonly correct: boolean;
  readonly clearedStage: boolean;
  readonly failed: boolean;
  readonly scoreGain: number;
}

export interface StageScoreInput {
  readonly difficultyId: DifficultyId;
  readonly stage: number;
  readonly remainingSeconds: number;
  readonly sequenceLength: number;
  readonly strikes: number;
}

export const DIRECTIONS: readonly { readonly id: DirectionId; readonly label: string; readonly key: string }[] = [
  { id: 'up', label: 'UP', key: 'ArrowUp' },
  { id: 'right', label: 'RIGHT', key: 'ArrowRight' },
  { id: 'down', label: 'DOWN', key: 'ArrowDown' },
  { id: 'left', label: 'LEFT', key: 'ArrowLeft' },
] as const;

export const DIFFICULTIES: readonly DifficultyConfig[] = [
  {
    id: 'easy',
    label: 'Easy',
    baseSequenceLength: 5,
    baseTimeSeconds: 18,
    minTimeSeconds: 10,
    strikePenaltySeconds: 2,
    scoreBase: 1600,
    timeBonus: 40,
  },
  {
    id: 'normal',
    label: 'Normal',
    baseSequenceLength: 6,
    baseTimeSeconds: 16,
    minTimeSeconds: 9,
    strikePenaltySeconds: 2.5,
    scoreBase: 2400,
    timeBonus: 48,
  },
  {
    id: 'hard',
    label: 'Hard',
    baseSequenceLength: 7,
    baseTimeSeconds: 14,
    minTimeSeconds: 8,
    strikePenaltySeconds: 3,
    scoreBase: 3400,
    timeBonus: 56,
  },
] as const;

export function getDifficulty(difficultyId: DifficultyId): DifficultyConfig {
  const difficulty = DIFFICULTIES.find((entry) => entry.id === difficultyId);

  if (!difficulty) {
    throw new Error(`Unknown difficulty: ${difficultyId}`);
  }

  return difficulty;
}

export function createInitialState(
  difficultyId: DifficultyId = 'normal',
  seed = Date.now(),
  stage = 1,
  score = 0,
  failures = 0,
): StageState {
  const difficulty = getDifficulty(difficultyId);
  const safeStage = Math.max(1, Math.floor(stage));
  const sequenceLength = getSequenceLength(difficulty, safeStage);

  return {
    difficulty,
    sequence: createSequence(sequenceLength, seed),
    progressIndex: 0,
    remainingSeconds: getStageTimeSeconds(difficulty, safeStage),
    stageTimeSeconds: getStageTimeSeconds(difficulty, safeStage),
    stage: safeStage,
    score,
    strikes: 0,
    failures,
    seed,
  };
}

export function submitSignal(state: StageState, directionId: DirectionId): AnswerResult {
  const expected = state.sequence[state.progressIndex];

  if (!expected || expected !== directionId) {
    const nextState = {
      ...state,
      strikes: state.strikes + 1,
      remainingSeconds: Math.max(0, state.remainingSeconds - state.difficulty.strikePenaltySeconds),
    };

    return {
      state: nextState,
      correct: false,
      clearedStage: false,
      failed: isFailed(nextState),
      scoreGain: 0,
    };
  }

  const nextProgressIndex = state.progressIndex + 1;

  if (nextProgressIndex < state.sequence.length) {
    return {
      state: {
        ...state,
        progressIndex: nextProgressIndex,
      },
      correct: true,
      clearedStage: false,
      failed: false,
      scoreGain: 0,
    };
  }

  const scoreGain = calculateStageScore({
    difficultyId: state.difficulty.id,
    stage: state.stage,
    remainingSeconds: state.remainingSeconds,
    sequenceLength: state.sequence.length,
    strikes: state.strikes,
  });
  const nextStage = state.stage + 1;
  const nextState = createInitialState(
    state.difficulty.id,
    state.seed + state.stage * 9173,
    nextStage,
    state.score + scoreGain,
    state.failures,
  );

  return {
    state: nextState,
    correct: true,
    clearedStage: true,
    failed: false,
    scoreGain,
  };
}

export function tickTimer(state: StageState, seconds = 1): StageState {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return state;
  }

  return {
    ...state,
    remainingSeconds: Math.max(0, state.remainingSeconds - seconds),
  };
}

export function isTimedOut(state: StageState): boolean {
  return state.remainingSeconds <= 0;
}

export function isFailed(state: StageState): boolean {
  return state.strikes >= 3 || isTimedOut(state);
}

export function recordFailure(state: StageState): StageState {
  return {
    ...state,
    failures: state.failures + 1,
    remainingSeconds: 0,
  };
}

export function calculateStageScore(input: StageScoreInput): number {
  const difficulty = getDifficulty(input.difficultyId);
  const rawScore = difficulty.scoreBase
    + input.stage * 180
    + input.sequenceLength * 120
    + Math.floor(input.remainingSeconds) * difficulty.timeBonus
    - input.strikes * 260;

  return Math.max(200, rawScore);
}

export function getSequenceLength(difficulty: DifficultyConfig, stage: number): number {
  return difficulty.baseSequenceLength + Math.max(0, Math.floor(stage) - 1);
}

export function getStageTimeSeconds(difficulty: DifficultyConfig, stage: number): number {
  const safeStage = Math.max(1, Math.floor(stage));
  return Math.max(difficulty.minTimeSeconds, difficulty.baseTimeSeconds - (safeStage - 1) * 0.4);
}

export function createSequence(length: number, seed: number): readonly DirectionId[] {
  const random = createSeededRandom(seed);

  return Array.from({ length }, () => {
    const index = Math.floor(random() * DIRECTIONS.length);
    return DIRECTIONS[index]?.id ?? 'up';
  });
}

export function createSeededRandom(seed: number): () => number {
  let value = Math.trunc(seed) >>> 0;

  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}
