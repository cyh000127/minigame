export type GamePhase = 'ready' | 'playing' | 'feedback' | 'paused' | 'game-over' | 'finished';
export type RandomSource = () => number;

export interface TargetZone {
  readonly center: number;
  readonly width: number;
}

export interface StopResult {
  readonly success: boolean;
  readonly accuracy: number;
  readonly points: number;
  readonly message: 'perfect' | 'great' | 'good' | 'miss';
}

export interface PerfectStopState {
  readonly phase: GamePhase;
  readonly previousPhase: Exclude<GamePhase, 'paused'> | null;
  readonly round: number;
  readonly lives: number;
  readonly score: number;
  readonly bestScore: number;
  readonly streak: number;
  readonly cursor: number;
  readonly direction: 1 | -1;
  readonly target: TargetZone;
  readonly lastResult: StopResult | null;
}

export const ROUND_LIMIT = 12;
export const INITIAL_LIVES = 3;
export const INITIAL_SPEED = 0.42;
export const SPEED_STEP = 0.04;
export const INITIAL_ZONE_WIDTH = 0.3;
export const MIN_ZONE_WIDTH = 0.08;
export const ZONE_SHRINK_PER_ROUND = 0.018;
export const PERFECT_THRESHOLD = 0.9;
export const GREAT_THRESHOLD = 0.65;
export const GOOD_THRESHOLD = 0.35;

const READY_TARGET: TargetZone = {
  center: 0.5,
  width: INITIAL_ZONE_WIDTH,
};

export function createGameState(bestScore = 0): PerfectStopState {
  return {
    phase: 'ready',
    previousPhase: null,
    round: 0,
    lives: INITIAL_LIVES,
    score: 0,
    bestScore,
    streak: 0,
    cursor: 0.5,
    direction: 1,
    target: READY_TARGET,
    lastResult: null,
  };
}

export function startGame(
  state: PerfectStopState,
  random: RandomSource = Math.random,
): PerfectStopState {
  if (state.phase === 'paused') {
    return resumeGame(state);
  }

  if (state.phase !== 'ready') {
    return state;
  }

  return {
    ...state,
    phase: 'playing',
    previousPhase: null,
    round: 1,
    lives: INITIAL_LIVES,
    score: 0,
    streak: 0,
    cursor: 0,
    direction: 1,
    target: createTargetZone(1, random),
    lastResult: null,
  };
}

export function pauseGame(state: PerfectStopState): PerfectStopState {
  if (state.phase !== 'playing' && state.phase !== 'feedback') {
    return state;
  }

  return {
    ...state,
    phase: 'paused',
    previousPhase: state.phase,
  };
}

export function resumeGame(state: PerfectStopState): PerfectStopState {
  if (state.phase !== 'paused' || !state.previousPhase) {
    return state;
  }

  return {
    ...state,
    phase: state.previousPhase,
    previousPhase: null,
  };
}

export function tickGame(state: PerfectStopState, deltaMs: number): PerfectStopState {
  if (state.phase !== 'playing') {
    return state;
  }

  const movement = getCursorSpeed(state.round) * (deltaMs / 1000) * state.direction;
  const nextCursor = state.cursor + movement;

  if (nextCursor > 1) {
    return {
      ...state,
      cursor: 1 - (nextCursor - 1),
      direction: -1,
    };
  }

  if (nextCursor < 0) {
    return {
      ...state,
      cursor: -nextCursor,
      direction: 1,
    };
  }

  return {
    ...state,
    cursor: nextCursor,
  };
}

export function stopCursor(state: PerfectStopState): PerfectStopState {
  if (state.phase !== 'playing') {
    return state;
  }

  const result = evaluateStop(state.cursor, state.target, state.round, state.streak);
  const lives = result.success ? state.lives : state.lives - 1;
  const score = state.score + result.points;
  const streak = result.success ? state.streak + 1 : 0;
  const phase = lives <= 0 ? 'game-over' : state.round >= ROUND_LIMIT ? 'finished' : 'feedback';

  return {
    ...state,
    phase,
    previousPhase: null,
    lives,
    score,
    bestScore: Math.max(state.bestScore, score),
    streak,
    lastResult: result,
  };
}

export function advanceRound(
  state: PerfectStopState,
  random: RandomSource = Math.random,
): PerfectStopState {
  if (state.phase !== 'feedback') {
    return state;
  }

  const round = state.round + 1;

  return {
    ...state,
    phase: 'playing',
    previousPhase: null,
    round,
    cursor: state.direction === 1 ? 0 : 1,
    direction: state.direction === 1 ? -1 : 1,
    target: createTargetZone(round, random),
    lastResult: null,
  };
}

export function forceGameOver(state: PerfectStopState): PerfectStopState {
  if (state.phase === 'game-over') {
    return state;
  }

  return {
    ...state,
    phase: 'game-over',
    previousPhase: null,
    bestScore: Math.max(state.bestScore, state.score),
  };
}

export function evaluateStop(
  cursor: number,
  target: TargetZone,
  round: number,
  streak: number,
): StopResult {
  const distance = Math.abs(cursor - target.center);
  const halfWidth = target.width / 2;
  const success = distance <= halfWidth;
  const accuracy = success ? clamp01(1 - distance / halfWidth) : 0;

  if (!success) {
    return {
      success: false,
      accuracy,
      points: 0,
      message: 'miss',
    };
  }

  const basePoints = 80 + round * 12;
  const accuracyPoints = Math.round(accuracy * 120);
  const streakPoints = streak * 15;
  const points = basePoints + accuracyPoints + streakPoints;

  return {
    success,
    accuracy,
    points,
    message: getResultMessage(accuracy),
  };
}

export function createTargetZone(
  round: number,
  random: RandomSource = Math.random,
): TargetZone {
  const width = getZoneWidth(round);
  const margin = width / 2;
  const center = margin + random() * (1 - width);

  return {
    center,
    width,
  };
}

export function getCursorSpeed(round: number): number {
  return INITIAL_SPEED + Math.max(0, round - 1) * SPEED_STEP;
}

export function getZoneWidth(round: number): number {
  return Math.max(MIN_ZONE_WIDTH, INITIAL_ZONE_WIDTH - Math.max(0, round - 1) * ZONE_SHRINK_PER_ROUND);
}

export function getResultLabel(result: StopResult | null): string {
  if (!result) {
    return 'READY';
  }

  if (result.message === 'perfect') {
    return 'PERFECT';
  }

  if (result.message === 'great') {
    return 'GREAT';
  }

  if (result.message === 'good') {
    return 'GOOD';
  }

  return 'MISS';
}

function getResultMessage(accuracy: number): StopResult['message'] {
  if (accuracy >= PERFECT_THRESHOLD) {
    return 'perfect';
  }

  if (accuracy >= GREAT_THRESHOLD) {
    return 'great';
  }

  if (accuracy >= GOOD_THRESHOLD) {
    return 'good';
  }

  return 'good';
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
