export const laneCount = 4;
export const roadRows = 12;
export const playerRow = roadRows - 1;
export const startingLane = 1;
export const nearMissScore = 25;

export type GamePhase = 'ready' | 'running' | 'game-over';
export type Direction = 'left' | 'right';
export type RoadObjectKind = 'car' | 'barrier';
export type RoadMode = 'day' | 'night' | 'rain';

export interface RoadObject {
  id: number;
  lane: number;
  row: number;
  kind: RoadObjectKind;
  nearMissAwarded?: boolean;
}

export interface RoadRacerState {
  phase: GamePhase;
  playerLane: number;
  score: number;
  nearMissCount: number;
  nearMissBonus: number;
  elapsedMs: number;
  speedLevel: number;
  roadMode: RoadMode;
  stepAccumulatorMs: number;
  nextObjectId: number;
  objects: RoadObject[];
  crashedObjectId: number | null;
}

const minimumStepMs = 130;
const baseStepMs = 520;
const speedStepMs = 42;

export function createInitialGameState(): RoadRacerState {
  return {
    phase: 'ready',
    playerLane: startingLane,
    score: 0,
    nearMissCount: 0,
    nearMissBonus: 0,
    elapsedMs: 0,
    speedLevel: 1,
    roadMode: 'day',
    stepAccumulatorMs: 0,
    nextObjectId: 1,
    objects: [],
    crashedObjectId: null
  };
}

export function startGame(): RoadRacerState {
  return {
    ...createInitialGameState(),
    phase: 'running'
  };
}

export function calculateSpeedLevel(elapsedMs: number): number {
  return Math.min(12, 1 + Math.floor(Math.max(0, elapsedMs) / 8000));
}

export function calculateStepMs(speedLevel: number): number {
  return Math.max(minimumStepMs, baseStepMs - (Math.max(1, speedLevel) - 1) * speedStepMs);
}

export function calculateScore(elapsedMs: number): number {
  return Math.floor(Math.max(0, elapsedMs) / 100);
}

export function calculateRoadMode(elapsedMs: number): RoadMode {
  const modeIndex = Math.floor(Math.max(0, elapsedMs) / 18_000) % 3;

  if (modeIndex === 1) {
    return 'night';
  }

  if (modeIndex === 2) {
    return 'rain';
  }

  return 'day';
}

export function movePlayer(state: RoadRacerState, direction: Direction): RoadRacerState {
  if (state.phase !== 'running') {
    return state;
  }

  const laneDelta = direction === 'left' ? -1 : 1;
  const playerLane = Math.max(0, Math.min(laneCount - 1, state.playerLane + laneDelta));
  const movedState = {
    ...state,
    playerLane
  };

  const collisionState = resolveCollision(movedState);

  return collisionState.phase === 'running' ? applyNearMissBonuses(collisionState) : collisionState;
}

export function updateGame(state: RoadRacerState, deltaMs: number, random: () => number = Math.random): RoadRacerState {
  if (state.phase !== 'running') {
    return state;
  }

  const elapsedMs = state.elapsedMs + Math.max(0, deltaMs);
  const speedLevel = calculateSpeedLevel(elapsedMs);
  const roadMode = calculateRoadMode(elapsedMs);
  const score = calculateScore(elapsedMs) + state.nearMissBonus;
  const stepMs = calculateStepMs(speedLevel);
  let stepAccumulatorMs = state.stepAccumulatorMs + Math.max(0, deltaMs);
  let nextObjectId = state.nextObjectId;
  let objects = state.objects;
  let nextState: RoadRacerState = {
    ...state,
    elapsedMs,
    speedLevel,
    roadMode,
    score,
    stepAccumulatorMs
  };

  while (stepAccumulatorMs >= stepMs && nextState.phase === 'running') {
    stepAccumulatorMs -= stepMs;
    objects = advanceObjects(objects);

    if (shouldSpawnObject(speedLevel, random)) {
      const spawned = createRoadObject(nextObjectId, random);
      nextObjectId += 1;

      if (!objects.some((object) => object.row === 0 && object.lane === spawned.lane)) {
        objects = [...objects, spawned];
      }
    }

    nextState = resolveCollision({
      ...nextState,
      objects,
      nextObjectId,
      stepAccumulatorMs
    });

    if (nextState.phase === 'running') {
      nextState = applyNearMissBonuses(nextState);
      objects = nextState.objects;
    }
  }

  return {
    ...nextState,
    objects,
    nextObjectId,
    stepAccumulatorMs
  };
}

function advanceObjects(objects: RoadObject[]): RoadObject[] {
  return objects
    .map((object) => ({
      ...object,
      row: object.row + 1
    }))
    .filter((object) => object.row <= playerRow);
}

function shouldSpawnObject(speedLevel: number, random: () => number): boolean {
  const chance = Math.min(0.86, 0.42 + speedLevel * 0.035);

  return random() < chance;
}

function createRoadObject(id: number, random: () => number): RoadObject {
  return {
    id,
    lane: Math.min(laneCount - 1, Math.floor(random() * laneCount)),
    row: 0,
    kind: random() < 0.72 ? 'car' : 'barrier',
    nearMissAwarded: false
  };
}

function resolveCollision(state: RoadRacerState): RoadRacerState {
  const crashedObject = state.objects.find(
    (object) => object.row === playerRow && object.lane === state.playerLane
  );

  if (!crashedObject) {
    return state;
  }

  return {
    ...state,
    phase: 'game-over',
    crashedObjectId: crashedObject.id
  };
}

function applyNearMissBonuses(state: RoadRacerState): RoadRacerState {
  let nearMissCount = state.nearMissCount;
  let nearMissBonus = state.nearMissBonus;
  const objects = state.objects.map((object) => {
    const closeDodge =
      object.row === playerRow &&
      Math.abs(object.lane - state.playerLane) === 1 &&
      object.nearMissAwarded !== true;

    if (!closeDodge) {
      return object;
    }

    nearMissCount += 1;
    nearMissBonus += nearMissScore;

    return {
      ...object,
      nearMissAwarded: true
    };
  });

  if (nearMissCount === state.nearMissCount) {
    return state;
  }

  return {
    ...state,
    objects,
    nearMissCount,
    nearMissBonus,
    score: calculateScore(state.elapsedMs) + nearMissBonus
  };
}
