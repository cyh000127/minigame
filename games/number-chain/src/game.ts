export interface StageConfig {
  readonly stage: number;
  readonly gridSize: number;
  readonly targetLength: number;
  readonly timeLimitMs: number;
  readonly stageBonus: number;
}

export interface Position {
  readonly row: number;
  readonly col: number;
}

export interface BoardCell {
  readonly value: number;
  readonly isPath: boolean;
}

export interface BoardSpec {
  readonly size: number;
  readonly cells: readonly BoardCell[];
  readonly path: readonly Position[];
}

export interface PersistedBest {
  readonly score: number;
  readonly stage: number;
  readonly createdAt: string;
}

export const STORAGE_KEY = 'number-chain-best';

export function createStageConfig(stage: number): StageConfig {
  const currentStage = Math.max(1, Math.floor(stage));
  const gridSize = Math.min(7, 4 + Math.floor((currentStage - 1) / 2));
  const targetLength = Math.min(gridSize * gridSize, 5 + currentStage);
  const timeLimitMs = Math.max(10000, 28000 - (currentStage - 1) * 1200);
  const stageBonus = 500 + (currentStage - 1) * 180;

  return {
    stage: currentStage,
    gridSize,
    targetLength,
    timeLimitMs,
    stageBonus,
  };
}

export function generateBoard(
  stage: number,
  random: () => number = Math.random,
): BoardSpec {
  const config = createStageConfig(stage);
  const size = config.gridSize;
  const path = createPath(size, config.targetLength, random);
  const total = size * size;
  const pathKey = new Map<string, number>();

  path.forEach((position, index) => {
    pathKey.set(`${position.row}:${position.col}`, index + 1);
  });

  const cells = Array.from({ length: total }, (_, index) => {
    const row = Math.floor(index / size);
    const col = index % size;
    const key = `${row}:${col}`;
    const pathValue = pathKey.get(key);

    if (pathValue) {
      return {
        value: pathValue,
        isPath: true,
      };
    }

    return {
      value: config.targetLength + 1 + Math.floor(random() * 9),
      isPath: false,
    };
  });

  return {
    size,
    cells,
    path,
  };
}

export function isAdjacent(a: Position, b: Position): boolean {
  const rowDistance = Math.abs(a.row - b.row);
  const colDistance = Math.abs(a.col - b.col);

  return rowDistance <= 1 && colDistance <= 1 && (rowDistance !== 0 || colDistance !== 0);
}

export function computeRoundScore(stage: number, remainingMs: number, streak: number): number {
  const base = 120 + stage * 40;
  const timeBonus = Math.floor(Math.max(0, remainingMs) / 200);
  const streakBonus = Math.max(0, streak - 1) * 15;

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

function createPath(size: number, targetLength: number, random: () => number): Position[] {
  const start: Position = {
    row: Math.floor(random() * size),
    col: Math.floor(random() * size),
  };
  const path: Position[] = [start];
  const visited = new Set<string>([`${start.row}:${start.col}`]);

  while (path.length < targetLength) {
    const current = path[path.length - 1];
    const candidates = getNeighbors(current, size).filter((neighbor) => {
      const key = `${neighbor.row}:${neighbor.col}`;
      return !visited.has(key);
    });

    if (candidates.length === 0) {
      return createPath(size, targetLength, random);
    }

    const next = candidates[Math.floor(random() * candidates.length)];
    path.push(next);
    visited.add(`${next.row}:${next.col}`);
  }

  return path;
}

function getNeighbors(position: Position, size: number): Position[] {
  const neighbors: Position[] = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) {
        continue;
      }

      const row = position.row + rowOffset;
      const col = position.col + colOffset;

      if (row >= 0 && row < size && col >= 0 && col < size) {
        neighbors.push({ row, col });
      }
    }
  }

  return neighbors;
}
