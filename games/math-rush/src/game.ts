export type DifficultyId = 'easy' | 'normal' | 'hard';
export type Operation = 'add' | 'subtract' | 'multiply';
export type DirectionId = 'up' | 'right' | 'down' | 'left';

export interface DirectionOption {
  readonly id: DirectionId;
  readonly label: string;
  readonly key: string;
}

export interface DifficultyConfig {
  readonly id: DifficultyId;
  readonly label: string;
  readonly startTimeMs: number;
  readonly minTimeMs: number;
  readonly decayMs: number;
  readonly wrongPenaltyMs: number;
  readonly scoreBase: number;
}

export interface Challenge {
  readonly question: string;
  readonly answer: number;
  readonly options: readonly [number, number, number, number];
  readonly correctIndex: number;
  readonly operation: Operation;
}

export interface MathRushState {
  readonly difficulty: DifficultyConfig;
  readonly challenge: Challenge;
  readonly score: number;
  readonly round: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly remainingMs: number;
  readonly maxTimeMs: number;
  readonly fever: boolean;
  readonly seed: number;
}

export interface AnswerResult {
  readonly state: MathRushState;
  readonly correct: boolean;
  readonly scoreGain: number;
  readonly gameOver: boolean;
}

export interface RoundScoreInput {
  readonly difficultyId: DifficultyId;
  readonly round: number;
  readonly streak: number;
  readonly remainingMs: number;
  readonly maxTimeMs: number;
}

interface RandomResult {
  readonly seed: number;
  readonly value: number;
}

interface GeneratedChallenge {
  readonly challenge: Challenge;
  readonly seed: number;
}

export const DIRECTIONS: readonly DirectionOption[] = [
  { id: 'up', label: 'UP', key: 'ArrowUp' },
  { id: 'right', label: 'RIGHT', key: 'ArrowRight' },
  { id: 'down', label: 'DOWN', key: 'ArrowDown' },
  { id: 'left', label: 'LEFT', key: 'ArrowLeft' },
] as const;

export const DIFFICULTIES: readonly DifficultyConfig[] = [
  {
    id: 'easy',
    label: 'Easy',
    startTimeMs: 6500,
    minTimeMs: 3600,
    decayMs: 95,
    wrongPenaltyMs: 1100,
    scoreBase: 90,
  },
  {
    id: 'normal',
    label: 'Normal',
    startTimeMs: 5400,
    minTimeMs: 2600,
    decayMs: 115,
    wrongPenaltyMs: 1400,
    scoreBase: 120,
  },
  {
    id: 'hard',
    label: 'Hard',
    startTimeMs: 4300,
    minTimeMs: 1900,
    decayMs: 130,
    wrongPenaltyMs: 1700,
    scoreBase: 160,
  },
] as const;

export function createInitialState(difficultyId: DifficultyId = 'normal', seed = Date.now()): MathRushState {
  const difficulty = getDifficulty(difficultyId);
  const generated = generateChallenge(1, seed);
  const maxTimeMs = getRoundTimeMs(difficulty, 1);

  return {
    difficulty,
    challenge: generated.challenge,
    score: 0,
    round: 1,
    streak: 0,
    bestStreak: 0,
    remainingMs: maxTimeMs,
    maxTimeMs,
    fever: false,
    seed: generated.seed,
  };
}

export function getDifficulty(difficultyId: DifficultyId): DifficultyConfig {
  const difficulty = DIFFICULTIES.find((entry) => entry.id === difficultyId);

  if (!difficulty) {
    throw new Error(`Unknown difficulty: ${difficultyId}`);
  }

  return difficulty;
}

export function submitAnswer(state: MathRushState, optionIndex: number): AnswerResult {
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= state.challenge.options.length) {
    return createWrongResult(state);
  }

  if (optionIndex !== state.challenge.correctIndex) {
    return createWrongResult(state);
  }

  const nextStreak = state.streak + 1;
  const nextRound = state.round + 1;
  const scoreGain = calculateRoundScore({
    difficultyId: state.difficulty.id,
    round: state.round,
    streak: nextStreak,
    remainingMs: state.remainingMs,
    maxTimeMs: state.maxTimeMs,
  });
  const generated = generateChallenge(nextRound, state.seed);
  const nextMaxTimeMs = getRoundTimeMs(state.difficulty, nextRound);
  const nextState: MathRushState = {
    ...state,
    challenge: generated.challenge,
    score: state.score + scoreGain,
    round: nextRound,
    streak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
    remainingMs: nextMaxTimeMs,
    maxTimeMs: nextMaxTimeMs,
    fever: nextStreak >= 5,
    seed: generated.seed,
  };

  return {
    state: nextState,
    correct: true,
    scoreGain,
    gameOver: false,
  };
}

export function tickTimer(state: MathRushState, deltaMs: number): MathRushState {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    return state;
  }

  return {
    ...state,
    remainingMs: Math.max(0, state.remainingMs - deltaMs),
  };
}

export function isGameOver(state: MathRushState): boolean {
  return state.remainingMs <= 0;
}

export function calculateRoundScore(input: RoundScoreInput): number {
  const difficulty = getDifficulty(input.difficultyId);
  const speedRatio = input.maxTimeMs <= 0 ? 0 : input.remainingMs / input.maxTimeMs;
  const speedBonus = Math.max(0, Math.floor(speedRatio * 100));
  const comboBonus = Math.min(input.streak, 12) * 25;
  const feverMultiplier = input.streak >= 5 ? 2 : 1;

  return (difficulty.scoreBase + input.round * 8 + speedBonus + comboBonus) * feverMultiplier;
}

export function getRoundTimeMs(difficulty: DifficultyConfig, round: number): number {
  const safeRound = Math.max(1, Math.floor(round));

  return Math.max(difficulty.minTimeMs, difficulty.startTimeMs - (safeRound - 1) * difficulty.decayMs);
}

export function generateChallenge(round: number, seed: number): GeneratedChallenge {
  const operation = chooseOperation(round, seed);
  let nextSeed = operation.seed;
  const level = Math.floor((Math.max(1, round) - 1) / 4);
  const limit = Math.min(80, 12 + level * 8);
  let left = 0;
  let right = 0;
  let answer = 0;

  if (operation.value === 'multiply') {
    const leftResult = randomInt(nextSeed, 2, Math.min(12, 5 + level));
    const rightResult = randomInt(leftResult.seed, 2, Math.min(12, 6 + level));
    left = leftResult.value;
    right = rightResult.value;
    answer = left * right;
    nextSeed = rightResult.seed;
  } else if (operation.value === 'subtract') {
    const leftResult = randomInt(nextSeed, 6, limit + 8);
    const rightResult = randomInt(leftResult.seed, 1, Math.max(2, leftResult.value - 1));
    left = leftResult.value;
    right = rightResult.value;
    answer = left - right;
    nextSeed = rightResult.seed;
  } else {
    const leftResult = randomInt(nextSeed, 1, limit);
    const rightResult = randomInt(leftResult.seed, 1, limit);
    left = leftResult.value;
    right = rightResult.value;
    answer = left + right;
    nextSeed = rightResult.seed;
  }

  const options = createOptions(answer, round, nextSeed);

  return {
    challenge: {
      question: `${left} ${operationSymbol(operation.value)} ${right}`,
      answer,
      options: options.values,
      correctIndex: options.values.indexOf(answer),
      operation: operation.value,
    },
    seed: options.seed,
  };
}

export function nextRandom(seed: number): RandomResult {
  const nextSeed = (Math.imul(Math.trunc(seed) >>> 0, 1664525) + 1013904223) >>> 0;

  return {
    seed: nextSeed,
    value: nextSeed / 0x100000000,
  };
}

export function formatTime(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(1);
}

function chooseOperation(round: number, seed: number): { readonly value: Operation; readonly seed: number } {
  const safeRound = Math.max(1, Math.floor(round));
  const operations: readonly Operation[] = safeRound < 5
    ? ['add']
    : safeRound < 10
      ? ['add', 'subtract']
      : ['add', 'subtract', 'multiply'];
  const result = randomInt(seed, 0, operations.length - 1);

  return {
    value: operations[result.value] ?? 'add',
    seed: result.seed,
  };
}

function createOptions(answer: number, round: number, seed: number): { readonly values: [number, number, number, number]; readonly seed: number } {
  const values = new Set<number>([answer]);
  let nextSeed = seed;
  const offsetLimit = Math.max(6, Math.floor(Math.abs(answer) * 0.35) + Math.floor(round / 2));

  while (values.size < 4) {
    const offsetResult = randomInt(nextSeed, 1, offsetLimit);
    const signResult = nextRandom(offsetResult.seed);
    nextSeed = signResult.seed;

    const signedOffset = signResult.value < 0.5 ? -offsetResult.value : offsetResult.value;
    const candidate = Math.max(0, answer + signedOffset + values.size - 1);

    if (candidate !== answer) {
      values.add(candidate);
    }
  }

  const shuffled = shuffle([...values], nextSeed);

  return {
    values: toOptionTuple(shuffled.values),
    seed: shuffled.seed,
  };
}

function createWrongResult(state: MathRushState): AnswerResult {
  const nextState = {
    ...state,
    streak: 0,
    fever: false,
    remainingMs: Math.max(0, state.remainingMs - state.difficulty.wrongPenaltyMs),
  };

  return {
    state: nextState,
    correct: false,
    scoreGain: 0,
    gameOver: isGameOver(nextState),
  };
}

function randomInt(seed: number, min: number, max: number): { readonly value: number; readonly seed: number } {
  const low = Math.ceil(min);
  const high = Math.floor(max);

  if (high < low) {
    throw new Error('max must be greater than or equal to min.');
  }

  const random = nextRandom(seed);

  return {
    value: low + Math.floor(random.value * (high - low + 1)),
    seed: random.seed,
  };
}

function shuffle(values: readonly number[], seed: number): { readonly values: readonly number[]; readonly seed: number } {
  const nextValues = [...values];
  let nextSeed = seed;

  for (let index = nextValues.length - 1; index > 0; index -= 1) {
    const result = randomInt(nextSeed, 0, index);
    const swapIndex = result.value;
    const current = nextValues[index] as number;

    nextValues[index] = nextValues[swapIndex] as number;
    nextValues[swapIndex] = current;
    nextSeed = result.seed;
  }

  return {
    values: nextValues,
    seed: nextSeed,
  };
}

function toOptionTuple(values: readonly number[]): [number, number, number, number] {
  if (values.length !== 4) {
    throw new Error('Exactly four options are required.');
  }

  return [values[0] as number, values[1] as number, values[2] as number, values[3] as number];
}

function operationSymbol(operation: Operation): string {
  if (operation === 'subtract') {
    return '-';
  }

  if (operation === 'multiply') {
    return 'x';
  }

  return '+';
}
