export interface StageSpec {
  readonly stage: number;
  readonly sequenceLength: number;
  readonly revealMs: number;
  readonly inputTimeMs: number;
  readonly roundTarget: number;
  readonly roundBonus: number;
}

export interface PersistedBest {
  readonly score: number;
  readonly stage: number;
  readonly createdAt: string;
}

export const STORAGE_KEY = 'safe-cracker-best';

export function createStageSpec(stage: number): StageSpec {
  const currentStage = Math.max(1, Math.floor(stage));

  return {
    stage: currentStage,
    sequenceLength: Math.min(10, 3 + currentStage - 1),
    revealMs: Math.max(900, 1900 - (currentStage - 1) * 120),
    inputTimeMs: Math.max(4200, 9000 - (currentStage - 1) * 350),
    roundTarget: Math.min(7, 3 + Math.floor((currentStage - 1) / 2)),
    roundBonus: 500 + (currentStage - 1) * 160,
  };
}

export function createSequence(length: number, random: () => number = Math.random): string {
  let sequence = '';

  for (let index = 0; index < length; index += 1) {
    sequence += Math.floor(random() * 10).toString();
  }

  return sequence;
}

export function computeRoundScore(stage: number, remainingMs: number, streak: number): number {
  const base = 140 + stage * 45;
  const timeBonus = Math.floor(Math.max(0, remainingMs) / 250);
  const streakBonus = Math.max(0, streak - 1) * 25;

  return base + timeBonus + streakBonus;
}

export function parseBest(raw: string | null): PersistedBest | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedBest;

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
