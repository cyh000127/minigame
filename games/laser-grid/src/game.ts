export const GRID_SIZE = 5;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const START_ENERGY = 3;
export const WARNING_DURATION_MS = 850;
export const ACTIVE_DURATION_MS = 340;
export const BASE_SPAWN_INTERVAL_MS = 1_250;
export const MIN_SPAWN_INTERVAL_MS = 520;
export const LEVEL_DURATION_MS = 9_000;
export const SCORE_PER_SECOND = 14;
export const LASER_SURVIVE_SCORE = 65;

export type GamePhase = 'ready' | 'playing' | 'paused' | 'game-over';
export type Direction = 'up' | 'right' | 'down' | 'left';
export type LaserAxis = 'row' | 'column';
export type LaserPhase = 'warning' | 'active';
export type RandomSource = () => number;

export interface Position {
  row: number;
  column: number;
}

export interface LaserBeam {
  id: number;
  axis: LaserAxis;
  index: number;
  phase: LaserPhase;
  remainingMs: number;
  hasHitPlayer: boolean;
}

export interface LaserGridState {
  phase: GamePhase;
  player: Position;
  lasers: LaserBeam[];
  score: number;
  bestScore: number;
  energy: number;
  level: number;
  elapsedMs: number;
  spawnTimerMs: number;
  nextLaserId: number;
}

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  KeyW: 'up',
  KeyD: 'right',
  KeyS: 'down',
  KeyA: 'left',
  w: 'up',
  d: 'right',
  s: 'down',
  a: 'left',
  W: 'up',
  D: 'right',
  S: 'down',
  A: 'left',
};

export function createGameState(bestScore = 0): LaserGridState {
  return {
    phase: 'ready',
    player: {
      row: Math.floor(GRID_SIZE / 2),
      column: Math.floor(GRID_SIZE / 2),
    },
    lasers: [],
    score: 0,
    bestScore,
    energy: START_ENERGY,
    level: 1,
    elapsedMs: 0,
    spawnTimerMs: 700,
    nextLaserId: 1,
  };
}

export function startGame(state: LaserGridState): LaserGridState {
  if (state.phase === 'ready' || state.phase === 'paused') {
    return {
      ...state,
      phase: 'playing',
    };
  }

  return state;
}

export function pauseGame(state: LaserGridState): LaserGridState {
  if (state.phase !== 'playing') {
    return state;
  }

  return {
    ...state,
    phase: 'paused',
  };
}

export function forceGameOver(state: LaserGridState): LaserGridState {
  if (state.phase === 'game-over') {
    return state;
  }

  return {
    ...state,
    phase: 'game-over',
    bestScore: Math.max(state.bestScore, Math.trunc(state.score)),
  };
}

export function movePlayer(state: LaserGridState, direction: Direction): LaserGridState {
  if (state.phase !== 'playing') {
    return state;
  }

  const player = getMovedPosition(state.player, direction);
  return applyLaserHits({
    ...state,
    player,
  });
}

export function tickGame(
  state: LaserGridState,
  deltaMs: number,
  random: RandomSource = Math.random,
): LaserGridState {
  if (state.phase !== 'playing') {
    return state;
  }

  const safeDeltaMs = Math.max(0, deltaMs);
  const elapsedMs = state.elapsedMs + safeDeltaMs;
  const level = getLevel(elapsedMs);
  let nextState: LaserGridState = {
    ...state,
    elapsedMs,
    level,
    score: state.score + (safeDeltaMs / 1000) * SCORE_PER_SECOND,
    spawnTimerMs: state.spawnTimerMs - safeDeltaMs,
  };

  while (nextState.spawnTimerMs <= 0) {
    nextState = spawnLaser(nextState, random);
    nextState = {
      ...nextState,
      spawnTimerMs: nextState.spawnTimerMs + getSpawnInterval(nextState.level),
    };
  }

  nextState = updateLasers(nextState, safeDeltaMs);
  nextState = applyLaserHits(nextState);

  return {
    ...nextState,
    bestScore: Math.max(nextState.bestScore, Math.trunc(nextState.score)),
  };
}

export function spawnLaser(
  state: LaserGridState,
  random: RandomSource = Math.random,
): LaserGridState {
  const axis: LaserAxis = random() < 0.5 ? 'row' : 'column';
  const index = Math.floor(clamp(random(), 0, 0.999999) * GRID_SIZE);
  const laser: LaserBeam = {
    id: state.nextLaserId,
    axis,
    index,
    phase: 'warning',
    remainingMs: WARNING_DURATION_MS,
    hasHitPlayer: false,
  };

  return {
    ...state,
    lasers: [...state.lasers, laser],
    nextLaserId: state.nextLaserId + 1,
  };
}

export function isLaserOnPosition(laser: LaserBeam, position: Position): boolean {
  return laser.axis === 'row' ? laser.index === position.row : laser.index === position.column;
}

export function getDirectionFromInput(input: string): Direction | null {
  return KEY_TO_DIRECTION[input] ?? null;
}

export function getSpawnInterval(level: number): number {
  return Math.max(MIN_SPAWN_INTERVAL_MS, BASE_SPAWN_INTERVAL_MS - (level - 1) * 90);
}

export function getLevel(elapsedMs: number): number {
  return Math.floor(Math.max(0, elapsedMs) / LEVEL_DURATION_MS) + 1;
}

function updateLasers(state: LaserGridState, deltaMs: number): LaserGridState {
  let score = state.score;
  const lasers = state.lasers.flatMap((laser): LaserBeam[] => {
    let remainingMs = laser.remainingMs - deltaMs;

    if (laser.phase === 'warning' && remainingMs <= 0) {
      remainingMs += ACTIVE_DURATION_MS;

      if (remainingMs <= 0) {
        score += LASER_SURVIVE_SCORE;
        return [];
      }

      return [
        {
          ...laser,
          phase: 'active',
          remainingMs,
        },
      ];
    }

    if (laser.phase === 'active' && remainingMs <= 0) {
      if (!laser.hasHitPlayer) {
        score += LASER_SURVIVE_SCORE;
      }

      return [];
    }

    return [
      {
        ...laser,
        remainingMs,
      },
    ];
  });

  return {
    ...state,
    lasers,
    score,
  };
}

function applyLaserHits(state: LaserGridState): LaserGridState {
  if (state.phase !== 'playing') {
    return state;
  }

  let energy = state.energy;
  const lasers = state.lasers.map((laser) => {
    if (laser.phase !== 'active' || laser.hasHitPlayer || !isLaserOnPosition(laser, state.player)) {
      return laser;
    }

    energy -= 1;
    return {
      ...laser,
      hasHitPlayer: true,
    };
  });

  if (energy <= 0) {
    return forceGameOver({
      ...state,
      lasers,
      energy: 0,
    });
  }

  return {
    ...state,
    lasers,
    energy,
  };
}

function getMovedPosition(position: Position, direction: Direction): Position {
  if (direction === 'up') {
    return {
      ...position,
      row: Math.max(0, position.row - 1),
    };
  }

  if (direction === 'right') {
    return {
      ...position,
      column: Math.min(GRID_SIZE - 1, position.column + 1),
    };
  }

  if (direction === 'down') {
    return {
      ...position,
      row: Math.min(GRID_SIZE - 1, position.row + 1),
    };
  }

  return {
    ...position,
    column: Math.max(0, position.column - 1),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
