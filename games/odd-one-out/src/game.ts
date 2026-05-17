export interface DifficultyConfig {
  readonly stage: number;
  readonly gridSize: number;
  readonly findsToClear: number;
  readonly timeLimitMs: number;
  readonly oddDelta: number;
  readonly stageBonus: number;
}

export interface TileColor {
  readonly base: string;
  readonly odd: string;
}

export interface RoundSpec {
  readonly id: number;
  readonly stage: number;
  readonly gridSize: number;
  readonly oddIndex: number;
  readonly colors: TileColor;
}

export interface PersistedScore {
  readonly score: number;
  readonly stage: number;
  readonly createdAt: string;
}

export const STORAGE_KEY = 'odd-one-out-best-score';

let roundId = 0;

export function createDifficulty(stage: number): DifficultyConfig {
  const normalizedStage = Math.max(1, Math.floor(stage));
  const gridSize = Math.min(7, 4 + Math.floor((normalizedStage - 1) / 2));
  const findsToClear = Math.min(8, 4 + Math.floor((normalizedStage - 1) / 2));
  const timeLimitMs = Math.max(18000, 34000 - (normalizedStage - 1) * 1200);
  const oddDelta = Math.max(8, 20 - (normalizedStage - 1) * 1.3);
  const stageBonus = 600 + (normalizedStage - 1) * 180;

  return {
    stage: normalizedStage,
    gridSize,
    findsToClear,
    timeLimitMs,
    oddDelta,
    stageBonus,
  };
}

export function createRound(stage: number, random: () => number = Math.random): RoundSpec {
  const difficulty = createDifficulty(stage);
  const totalTiles = difficulty.gridSize * difficulty.gridSize;
  const oddIndex = Math.floor(random() * totalTiles);
  const hue = Math.floor(random() * 360);
  const saturation = 68 + Math.floor(random() * 18);
  const lightness = 46 + Math.floor(random() * 16);
  const oddLightness = clamp(lightness + (random() > 0.5 ? difficulty.oddDelta : -difficulty.oddDelta), 20, 84);

  return {
    id: roundId++,
    stage: difficulty.stage,
    gridSize: difficulty.gridSize,
    oddIndex,
    colors: {
      base: `hsl(${hue} ${saturation}% ${lightness}%)`,
      odd: `hsl(${hue} ${saturation}% ${oddLightness}%)`,
    },
  };
}

export function computeCorrectScore(stage: number, remainingMs: number, streak: number): number {
  const safeRemaining = Math.max(0, remainingMs);
  const timeBonus = Math.floor(safeRemaining / 1000) * 12;
  const streakBonus = Math.max(0, streak - 1) * 18;

  return 120 + stage * 35 + timeBonus + streakBonus;
}

export function computeStageClearBonus(stage: number): number {
  return createDifficulty(stage).stageBonus;
}

export function parseBestScore(raw: string | null): PersistedScore | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedScore;

    if (
      typeof parsed.score !== 'number' ||
      typeof parsed.stage !== 'number' ||
      typeof parsed.createdAt !== 'string'
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
