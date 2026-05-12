export type Direction = 'up' | 'right' | 'down' | 'left';
export type ColorId = 'red' | 'yellow' | 'blue' | 'green';
export type RoundRule = 'match' | 'opposite';
export type GamePhase = 'ready' | 'playing' | 'game-over';

export interface DirectionColor {
  readonly direction: Direction;
  readonly color: ColorId;
  readonly label: string;
  readonly keyLabel: string;
  readonly hex: string;
  readonly textColor: string;
}

export interface Round {
  readonly targetColor: ColorId;
  readonly rule: RoundRule;
  readonly correctColor: ColorId;
  readonly correctDirection: Direction;
}

export interface Feedback {
  readonly kind: 'ready' | 'correct' | 'wrong' | 'timeout';
  readonly message: string;
}

export interface ColorMatchState {
  readonly phase: GamePhase;
  readonly score: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly correctCount: number;
  readonly roundIndex: number;
  readonly speedLevel: number;
  readonly maxTimeMs: number;
  readonly timeLeftMs: number;
  readonly feverUntilMs: number;
  readonly round: Round;
  readonly feedback: Feedback;
}

export type RandomSource = () => number;

export const DIRECTION_COLORS: readonly DirectionColor[] = [
  {
    direction: 'up',
    color: 'red',
    label: 'RED',
    keyLabel: 'UP',
    hex: '#ff3f63',
    textColor: '#fff7fa',
  },
  {
    direction: 'right',
    color: 'yellow',
    label: 'YELLOW',
    keyLabel: 'RIGHT',
    hex: '#ffd447',
    textColor: '#15120a',
  },
  {
    direction: 'down',
    color: 'blue',
    label: 'BLUE',
    keyLabel: 'DOWN',
    hex: '#44d7ff',
    textColor: '#06111a',
  },
  {
    direction: 'left',
    color: 'green',
    label: 'GREEN',
    keyLabel: 'LEFT',
    hex: '#58f08b',
    textColor: '#061108',
  },
] as const;

export const OPPOSITE_COLORS: Record<ColorId, ColorId> = {
  red: 'blue',
  blue: 'red',
  yellow: 'green',
  green: 'yellow',
};

export const SETTINGS = {
  initialTimeMs: 4_500,
  minTimeMs: 1_550,
  correctTimeBonusMs: 700,
  minCorrectTimeBonusMs: 320,
  speedStepEvery: 6,
  feverThreshold: 8,
  feverDurationMs: 6_000,
  feverMultiplier: 5,
  baseScore: 100,
  streakBonus: 18,
  speedBonus: 12,
  maxTrapChance: 0.32,
} as const;

const initialRound: Round = {
  targetColor: 'red',
  rule: 'match',
  correctColor: 'red',
  correctDirection: 'up',
};

export function createReadyState(): ColorMatchState {
  return {
    phase: 'ready',
    score: 0,
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    roundIndex: 0,
    speedLevel: 1,
    maxTimeMs: SETTINGS.initialTimeMs,
    timeLeftMs: SETTINGS.initialTimeMs,
    feverUntilMs: 0,
    round: initialRound,
    feedback: {
      kind: 'ready',
      message: 'PRESS START',
    },
  };
}

export function startGame(random: RandomSource = Math.random): ColorMatchState {
  const speedLevel = 1;
  const maxTimeMs = getMaxTimeMs(speedLevel);

  return {
    ...createReadyState(),
    phase: 'playing',
    maxTimeMs,
    timeLeftMs: maxTimeMs,
    roundIndex: 1,
    round: createRound(speedLevel, random),
    feedback: {
      kind: 'ready',
      message: 'MATCH THE COLOR',
    },
  };
}

export function chooseDirection(
  state: ColorMatchState,
  direction: Direction,
  nowMs: number,
  random: RandomSource = Math.random,
): ColorMatchState {
  if (state.phase !== 'playing') {
    return state;
  }

  if (direction !== state.round.correctDirection) {
    return endGame(state, 'wrong', `WRONG KEY - ${state.round.correctDirection.toUpperCase()}`);
  }

  const nextCorrectCount = state.correctCount + 1;
  const nextStreak = state.streak + 1;
  const nextSpeedLevel = getSpeedLevel(nextCorrectCount);
  const maxTimeMs = getMaxTimeMs(nextSpeedLevel);
  const timeBonusMs = getCorrectTimeBonusMs(nextSpeedLevel);
  const feverUntilMs = getNextFeverUntilMs(state, nextStreak, nowMs);
  const feverActive = isFeverActive({ ...state, feverUntilMs }, nowMs);
  const scoreGain = getScoreGain(nextStreak, nextSpeedLevel, feverActive);
  const timeLeftMs = Math.min(maxTimeMs, state.timeLeftMs + timeBonusMs);

  return {
    ...state,
    score: state.score + scoreGain,
    streak: nextStreak,
    bestStreak: Math.max(state.bestStreak, nextStreak),
    correctCount: nextCorrectCount,
    roundIndex: state.roundIndex + 1,
    speedLevel: nextSpeedLevel,
    maxTimeMs,
    timeLeftMs,
    feverUntilMs,
    round: createRound(nextSpeedLevel, random),
    feedback: {
      kind: 'correct',
      message: feverActive ? `FEVER +${scoreGain}` : `GOOD +${scoreGain}`,
    },
  };
}

export function tickTimer(
  state: ColorMatchState,
  elapsedMs: number,
  nowMs: number,
): ColorMatchState {
  if (state.phase !== 'playing') {
    return state;
  }

  const drainMultiplier = getTimerDrainMultiplier(state.speedLevel, isFeverActive(state, nowMs));
  const nextTimeLeftMs = Math.max(0, state.timeLeftMs - elapsedMs * drainMultiplier);

  if (nextTimeLeftMs <= 0) {
    return endGame({ ...state, timeLeftMs: 0 }, 'timeout', 'TIME OUT');
  }

  return {
    ...state,
    timeLeftMs: nextTimeLeftMs,
  };
}

export function createRound(speedLevel: number, random: RandomSource = Math.random): Round {
  const targetColor = getRandomColor(random);
  const trapChance = getTrapChance(speedLevel);
  const rule: RoundRule = random() < trapChance ? 'opposite' : 'match';
  const correctColor = rule === 'opposite' ? OPPOSITE_COLORS[targetColor] : targetColor;
  const correctDirection = getDirectionForColor(correctColor);

  return {
    targetColor,
    rule,
    correctColor,
    correctDirection,
  };
}

export function getColorForDirection(direction: Direction): DirectionColor {
  const directionColor = DIRECTION_COLORS.find((entry) => entry.direction === direction);

  if (!directionColor) {
    throw new Error(`Unknown direction: ${direction}`);
  }

  return directionColor;
}

export function getDirectionForColor(color: ColorId): Direction {
  const directionColor = DIRECTION_COLORS.find((entry) => entry.color === color);

  if (!directionColor) {
    throw new Error(`Unknown color: ${color}`);
  }

  return directionColor.direction;
}

export function getColorMeta(color: ColorId): DirectionColor {
  const directionColor = DIRECTION_COLORS.find((entry) => entry.color === color);

  if (!directionColor) {
    throw new Error(`Unknown color: ${color}`);
  }

  return directionColor;
}

export function getKeyboardDirection(key: string): Direction | null {
  const keyMap: Record<string, Direction> = {
    ArrowUp: 'up',
    ArrowRight: 'right',
    ArrowDown: 'down',
    ArrowLeft: 'left',
  };

  return keyMap[key] ?? null;
}

export function getMaxTimeMs(speedLevel: number): number {
  return Math.max(SETTINGS.minTimeMs, SETTINGS.initialTimeMs - (speedLevel - 1) * 260);
}

export function getCorrectTimeBonusMs(speedLevel: number): number {
  return Math.max(
    SETTINGS.minCorrectTimeBonusMs,
    SETTINGS.correctTimeBonusMs - (speedLevel - 1) * 36,
  );
}

export function getSpeedLevel(correctCount: number): number {
  return Math.floor(correctCount / SETTINGS.speedStepEvery) + 1;
}

export function getTrapChance(speedLevel: number): number {
  return Math.min(SETTINGS.maxTrapChance, 0.08 + speedLevel * 0.018);
}

export function getTimerDrainMultiplier(speedLevel: number, feverActive: boolean): number {
  const speedDrain = 1 + (speedLevel - 1) * 0.08;
  return feverActive ? speedDrain * 0.82 : speedDrain;
}

export function isFeverActive(state: Pick<ColorMatchState, 'feverUntilMs'>, nowMs: number): boolean {
  return state.feverUntilMs > nowMs;
}

export function getRuleLabel(rule: RoundRule): string {
  return rule === 'opposite' ? 'OPPOSITE' : 'MATCH';
}

function getScoreGain(streak: number, speedLevel: number, feverActive: boolean): number {
  const baseScore =
    SETTINGS.baseScore + streak * SETTINGS.streakBonus + speedLevel * SETTINGS.speedBonus;
  return baseScore * (feverActive ? SETTINGS.feverMultiplier : 1);
}

function getNextFeverUntilMs(
  state: ColorMatchState,
  nextStreak: number,
  nowMs: number,
): number {
  const feverIsRunning = isFeverActive(state, nowMs);

  if (!feverIsRunning && nextStreak >= SETTINGS.feverThreshold) {
    return nowMs + SETTINGS.feverDurationMs;
  }

  return state.feverUntilMs;
}

function getRandomColor(random: RandomSource): ColorId {
  const index = Math.min(DIRECTION_COLORS.length - 1, Math.floor(random() * DIRECTION_COLORS.length));

  switch (index) {
    case 1:
      return 'yellow';
    case 2:
      return 'blue';
    case 3:
      return 'green';
    case 0:
    default:
      return 'red';
  }
}

function endGame(
  state: ColorMatchState,
  kind: Extract<Feedback['kind'], 'wrong' | 'timeout'>,
  message: string,
): ColorMatchState {
  return {
    ...state,
    phase: 'game-over',
    streak: 0,
    feedback: {
      kind,
      message,
    },
  };
}
