export type DifficultyId = 'easy' | 'normal' | 'hard';
export type GamePhase = 'ready' | 'playing' | 'won' | 'lost';
export type RandomSource = () => number;

export interface Difficulty {
  readonly id: DifficultyId;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly mineCount: number;
}

export interface Cell {
  readonly index: number;
  readonly row: number;
  readonly column: number;
  readonly hasMine: boolean;
  readonly adjacentMines: number;
  readonly isRevealed: boolean;
  readonly isFlagged: boolean;
}

export interface MinesweeperState {
  readonly difficulty: Difficulty;
  readonly phase: GamePhase;
  readonly cells: readonly Cell[];
  readonly firstRevealDone: boolean;
  readonly revealedCount: number;
  readonly flagCount: number;
  readonly elapsedSeconds: number;
}

export const DIFFICULTIES: readonly Difficulty[] = [
  {
    id: 'easy',
    label: 'Easy',
    width: 9,
    height: 9,
    mineCount: 10,
  },
  {
    id: 'normal',
    label: 'Normal',
    width: 12,
    height: 12,
    mineCount: 24,
  },
  {
    id: 'hard',
    label: 'Hard',
    width: 16,
    height: 16,
    mineCount: 48,
  },
] as const;

export function createGameState(difficultyId: DifficultyId = 'easy'): MinesweeperState {
  const difficulty = getDifficulty(difficultyId);

  return {
    difficulty,
    phase: 'ready',
    cells: createEmptyCells(difficulty),
    firstRevealDone: false,
    revealedCount: 0,
    flagCount: 0,
    elapsedSeconds: 0,
  };
}

export function revealCell(
  state: MinesweeperState,
  index: number,
  random: RandomSource = Math.random,
): MinesweeperState {
  if (state.phase === 'won' || state.phase === 'lost') {
    return state;
  }

  const target = state.cells[index];

  if (!target || target.isRevealed || target.isFlagged) {
    return state;
  }

  const cells = state.firstRevealDone
    ? state.cells
    : createMinedCells(state.difficulty, index, random);
  const minedTarget = cells[index];

  if (!minedTarget) {
    return state;
  }

  if (minedTarget.hasMine) {
    return {
      ...state,
      phase: 'lost',
      cells: revealAllMines(cells),
      firstRevealDone: true,
    };
  }

  const revealIndexes = collectRevealIndexes(cells, index, state.difficulty);
  const nextCells = cells.map((cell) =>
    revealIndexes.has(cell.index)
      ? {
          ...cell,
          isRevealed: true,
          isFlagged: false,
        }
      : cell,
  );
  const revealedCount = countRevealed(nextCells);
  const phase = isWin(nextCells, state.difficulty) ? 'won' : 'playing';
  const finalCells = phase === 'won' ? flagAllMines(nextCells) : nextCells;

  return {
    ...state,
    phase,
    cells: finalCells,
    firstRevealDone: true,
    revealedCount,
    flagCount: countFlags(finalCells),
  };
}

export function toggleFlag(state: MinesweeperState, index: number): MinesweeperState {
  if (state.phase === 'won' || state.phase === 'lost') {
    return state;
  }

  const target = state.cells[index];

  if (!target || target.isRevealed) {
    return state;
  }

  const nextCells = state.cells.map((cell) =>
    cell.index === index
      ? {
          ...cell,
          isFlagged: !cell.isFlagged,
        }
      : cell,
  );

  return {
    ...state,
    phase: state.phase === 'ready' ? 'playing' : state.phase,
    cells: nextCells,
    flagCount: countFlags(nextCells),
  };
}

export function tickTimer(state: MinesweeperState, elapsedSeconds: number): MinesweeperState {
  if (state.phase !== 'playing') {
    return state;
  }

  return {
    ...state,
    elapsedSeconds: state.elapsedSeconds + elapsedSeconds,
  };
}

export function getDifficulty(id: DifficultyId): Difficulty {
  const difficulty = DIFFICULTIES.find((entry) => entry.id === id);

  if (!difficulty) {
    throw new Error(`Unknown difficulty: ${id}`);
  }

  return difficulty;
}

export function createEmptyCells(difficulty: Difficulty): readonly Cell[] {
  return Array.from({ length: difficulty.width * difficulty.height }, (_, index) =>
    createCell(difficulty, index, false, 0),
  );
}

export function createMinedCells(
  difficulty: Difficulty,
  firstRevealIndex: number,
  random: RandomSource = Math.random,
): readonly Cell[] {
  const mineIndexes = chooseMineIndexes(difficulty, firstRevealIndex, random);
  const cells = Array.from({ length: difficulty.width * difficulty.height }, (_, index) =>
    createCell(difficulty, index, mineIndexes.has(index), 0),
  );

  return cells.map((cell) => ({
    ...cell,
    adjacentMines: cell.hasMine ? 0 : countAdjacentMines(cells, cell.index, difficulty),
  }));
}

export function getNeighbors(index: number, difficulty: Difficulty): readonly number[] {
  const row = Math.floor(index / difficulty.width);
  const column = index % difficulty.width;
  const neighbors: number[] = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) {
        continue;
      }

      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;

      if (
        nextRow < 0 ||
        nextColumn < 0 ||
        nextRow >= difficulty.height ||
        nextColumn >= difficulty.width
      ) {
        continue;
      }

      neighbors.push(nextRow * difficulty.width + nextColumn);
    }
  }

  return neighbors;
}

export function getRemainingMines(state: MinesweeperState): number {
  return Math.max(0, state.difficulty.mineCount - state.flagCount);
}

function createCell(
  difficulty: Difficulty,
  index: number,
  hasMine: boolean,
  adjacentMines: number,
): Cell {
  return {
    index,
    row: Math.floor(index / difficulty.width),
    column: index % difficulty.width,
    hasMine,
    adjacentMines,
    isRevealed: false,
    isFlagged: false,
  };
}

function chooseMineIndexes(
  difficulty: Difficulty,
  firstRevealIndex: number,
  random: RandomSource,
): ReadonlySet<number> {
  const protectedIndexes = new Set([firstRevealIndex, ...getNeighbors(firstRevealIndex, difficulty)]);
  const candidates = Array.from({ length: difficulty.width * difficulty.height }, (_, index) => index)
    .filter((index) => !protectedIndexes.has(index));

  const mineIndexes = new Set<number>();
  const pool = [...candidates];

  while (mineIndexes.size < difficulty.mineCount && pool.length > 0) {
    const selectedIndex = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    const [mineIndex] = pool.splice(selectedIndex, 1);

    if (mineIndex !== undefined) {
      mineIndexes.add(mineIndex);
    }
  }

  return mineIndexes;
}

function countAdjacentMines(
  cells: readonly Cell[],
  index: number,
  difficulty: Difficulty,
): number {
  return getNeighbors(index, difficulty).filter((neighborIndex) => cells[neighborIndex]?.hasMine)
    .length;
}

function collectRevealIndexes(
  cells: readonly Cell[],
  startIndex: number,
  difficulty: Difficulty,
): ReadonlySet<number> {
  const revealed = new Set<number>();
  const queue = [startIndex];

  while (queue.length > 0) {
    const index = queue.shift();

    if (index === undefined || revealed.has(index)) {
      continue;
    }

    const cell = cells[index];

    if (!cell || cell.isFlagged || cell.hasMine) {
      continue;
    }

    revealed.add(index);

    if (cell.adjacentMines > 0) {
      continue;
    }

    for (const neighborIndex of getNeighbors(index, difficulty)) {
      if (!revealed.has(neighborIndex)) {
        queue.push(neighborIndex);
      }
    }
  }

  return revealed;
}

function revealAllMines(cells: readonly Cell[]): readonly Cell[] {
  return cells.map((cell) =>
    cell.hasMine
      ? {
          ...cell,
          isRevealed: true,
        }
      : cell,
  );
}

function flagAllMines(cells: readonly Cell[]): readonly Cell[] {
  return cells.map((cell) =>
    cell.hasMine
      ? {
          ...cell,
          isFlagged: true,
        }
      : cell,
  );
}

function isWin(cells: readonly Cell[], difficulty: Difficulty): boolean {
  return countRevealed(cells) === cells.length - difficulty.mineCount;
}

function countRevealed(cells: readonly Cell[]): number {
  return cells.filter((cell) => cell.isRevealed).length;
}

function countFlags(cells: readonly Cell[]): number {
  return cells.filter((cell) => cell.isFlagged).length;
}
