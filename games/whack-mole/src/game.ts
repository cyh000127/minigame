export type GamePhase = 'ready' | 'playing' | 'paused' | 'game-over' | 'finished';
export type RandomSource = () => number;

export interface Mole {
  readonly id: number;
  readonly hole: number;
  readonly remainingMs: number;
  readonly kind: 'normal' | 'gold';
}

export interface WhackMoleState {
  readonly phase: GamePhase;
  readonly previousPhase: Exclude<GamePhase, 'paused'> | null;
  readonly holes: number;
  readonly moles: readonly Mole[];
  readonly score: number;
  readonly bestScore: number;
  readonly lives: number;
  readonly level: number;
  readonly combo: number;
  readonly nextMoleId: number;
  readonly spawnCooldownMs: number;
  readonly remainingGameMs: number;
}

export const HOLE_COUNT = 9;
export const INITIAL_LIVES = 3;
export const GAME_DURATION_MS = 30_000;
export const INITIAL_MOLE_LIFETIME_MS = 1050;
export const MIN_MOLE_LIFETIME_MS = 520;
export const INITIAL_SPAWN_INTERVAL_MS = 820;
export const MIN_SPAWN_INTERVAL_MS = 330;
export const SCORE_PER_LEVEL = 300;
export const NORMAL_SCORE = 70;
export const GOLD_SCORE = 180;
export const GOLD_CHANCE = 0.16;

export function createGameState(bestScore = 0): WhackMoleState {
  return {
    phase: 'ready',
    previousPhase: null,
    holes: HOLE_COUNT,
    moles: [],
    score: 0,
    bestScore,
    lives: INITIAL_LIVES,
    level: 1,
    combo: 0,
    nextMoleId: 1,
    spawnCooldownMs: 0,
    remainingGameMs: GAME_DURATION_MS,
  };
}

export function startGame(
  state: WhackMoleState,
  random: RandomSource = Math.random,
): WhackMoleState {
  if (state.phase === 'paused') {
    return resumeGame(state);
  }

  if (state.phase !== 'ready') {
    return state;
  }

  const firstMole = createMole(1, [], 1, random);

  return {
    ...state,
    phase: 'playing',
    previousPhase: null,
    moles: [firstMole],
    score: 0,
    lives: INITIAL_LIVES,
    level: 1,
    combo: 0,
    nextMoleId: 2,
    spawnCooldownMs: getSpawnIntervalMs(1),
    remainingGameMs: GAME_DURATION_MS,
  };
}

export function pauseGame(state: WhackMoleState): WhackMoleState {
  if (state.phase !== 'playing') {
    return state;
  }

  return {
    ...state,
    phase: 'paused',
    previousPhase: 'playing',
  };
}

export function resumeGame(state: WhackMoleState): WhackMoleState {
  if (state.phase !== 'paused' || !state.previousPhase) {
    return state;
  }

  return {
    ...state,
    phase: state.previousPhase,
    previousPhase: null,
  };
}

export function tickGame(
  state: WhackMoleState,
  deltaMs: number,
  random: RandomSource = Math.random,
): WhackMoleState {
  if (state.phase !== 'playing') {
    return state;
  }

  const elapsedMs = Math.max(0, deltaMs);
  const remainingGameMs = Math.max(0, state.remainingGameMs - elapsedMs);
  const updatedMoles = state.moles.map((mole) => ({
    ...mole,
    remainingMs: mole.remainingMs - elapsedMs,
  }));
  const activeMoles = updatedMoles.filter((mole) => mole.remainingMs > 0);
  const missedCount = updatedMoles.length - activeMoles.length;
  const lives = state.lives - missedCount;

  if (remainingGameMs <= 0) {
    return {
      ...state,
      phase: 'finished',
      previousPhase: null,
      moles: activeMoles,
      lives: Math.max(0, lives),
      combo: missedCount > 0 ? 0 : state.combo,
      remainingGameMs: 0,
      bestScore: Math.max(state.bestScore, state.score),
    };
  }

  if (lives <= 0) {
    return {
      ...state,
      phase: 'game-over',
      previousPhase: null,
      moles: activeMoles,
      lives: 0,
      combo: 0,
      remainingGameMs,
      bestScore: Math.max(state.bestScore, state.score),
    };
  }

  let moles = activeMoles;
  let nextMoleId = state.nextMoleId;
  let spawnCooldownMs = state.spawnCooldownMs - elapsedMs;

  while (spawnCooldownMs <= 0 && moles.length < getMaxActiveMoles(state.level)) {
    moles = [...moles, createMole(nextMoleId, moles, state.level, random)];
    nextMoleId += 1;
    spawnCooldownMs += getSpawnIntervalMs(state.level);
  }

  return {
    ...state,
    moles,
    lives,
    combo: missedCount > 0 ? 0 : state.combo,
    nextMoleId,
    spawnCooldownMs,
    remainingGameMs,
  };
}

export function whackHole(state: WhackMoleState, hole: number): WhackMoleState {
  if (state.phase !== 'playing') {
    return state;
  }

  const target = state.moles.find((mole) => mole.hole === hole);

  if (!target) {
    const lives = state.lives - 1;

    return {
      ...state,
      phase: lives <= 0 ? 'game-over' : 'playing',
      lives: Math.max(0, lives),
      combo: 0,
      bestScore: Math.max(state.bestScore, state.score),
    };
  }

  const points = getMoleScore(target, state.level, state.combo);
  const score = state.score + points;
  const level = getLevel(score);

  return {
    ...state,
    moles: state.moles.filter((mole) => mole.id !== target.id),
    score,
    bestScore: Math.max(state.bestScore, score),
    level,
    combo: state.combo + 1,
    spawnCooldownMs: Math.min(state.spawnCooldownMs, getSpawnIntervalMs(level)),
  };
}

export function forceGameOver(state: WhackMoleState): WhackMoleState {
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

export function createMole(
  id: number,
  activeMoles: readonly Mole[],
  level: number,
  random: RandomSource = Math.random,
): Mole {
  const hole = pickEmptyHole(activeMoles, random);
  const kind = random() < GOLD_CHANCE ? 'gold' : 'normal';

  return {
    id,
    hole,
    kind,
    remainingMs: getMoleLifetimeMs(level),
  };
}

export function pickEmptyHole(activeMoles: readonly Mole[], random: RandomSource = Math.random): number {
  const occupied = new Set(activeMoles.map((mole) => mole.hole));
  const emptyHoles = Array.from({ length: HOLE_COUNT }, (_, index) => index).filter(
    (hole) => !occupied.has(hole),
  );

  if (emptyHoles.length === 0) {
    return 0;
  }

  const index = Math.min(emptyHoles.length - 1, Math.floor(random() * emptyHoles.length));
  const hole = emptyHoles[index];

  if (hole === undefined) {
    throw new Error('Unable to pick empty hole.');
  }

  return hole;
}

export function getMoleScore(mole: Mole, level: number, combo: number): number {
  const baseScore = mole.kind === 'gold' ? GOLD_SCORE : NORMAL_SCORE;
  return baseScore + level * 10 + combo * 8;
}

export function getLevel(score: number): number {
  return Math.floor(score / SCORE_PER_LEVEL) + 1;
}

export function getSpawnIntervalMs(level: number): number {
  return Math.max(MIN_SPAWN_INTERVAL_MS, INITIAL_SPAWN_INTERVAL_MS - (level - 1) * 55);
}

export function getMoleLifetimeMs(level: number): number {
  return Math.max(MIN_MOLE_LIFETIME_MS, INITIAL_MOLE_LIFETIME_MS - (level - 1) * 45);
}

export function getMaxActiveMoles(level: number): number {
  return Math.min(4, 1 + Math.floor((level - 1) / 3));
}

export function getKeyboardHole(key: string): number | null {
  if (!/^[1-9]$/.test(key)) {
    return null;
  }

  return Number(key) - 1;
}
