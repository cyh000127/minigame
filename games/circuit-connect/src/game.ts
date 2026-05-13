export type DifficultyId = 'easy' | 'normal' | 'hard';
export type RandomSource = () => number;

export interface DifficultyConfig {
  readonly id: DifficultyId;
  readonly label: string;
  readonly size: number;
  readonly branchSteps: number;
  readonly scoreBase: number;
  readonly timeBonus: number;
  readonly movePenalty: number;
  readonly roundTimeSeconds: number;
  readonly minRoundTimeSeconds: number;
}

export interface CircuitCell {
  readonly row: number;
  readonly col: number;
  readonly mask: number;
  readonly solutionMask: number;
  readonly isSource: boolean;
  readonly isGoal: boolean;
}

export type CircuitBoard = readonly (readonly CircuitCell[])[];

export interface CircuitState {
  readonly difficulty: DifficultyConfig;
  readonly board: CircuitBoard;
  readonly round: number;
  readonly score: number;
  readonly failures: number;
  readonly moves: number;
  readonly elapsedSeconds: number;
  readonly remainingSeconds: number;
  readonly roundTimeSeconds: number;
  readonly seed: number;
}

export interface RoundScoreInput {
  readonly difficultyId: DifficultyId;
  readonly round: number;
  readonly moves: number;
  readonly remainingSeconds: number;
  readonly activeCells: number;
}

interface Position {
  readonly row: number;
  readonly col: number;
}

interface Direction {
  readonly rowDelta: number;
  readonly colDelta: number;
  readonly bit: number;
  readonly opposite: number;
}

export const NORTH = 1;
export const EAST = 2;
export const SOUTH = 4;
export const WEST = 8;
export const EMPTY_MASK = 0;

export const DIRECTIONS: readonly Direction[] = [
  { rowDelta: -1, colDelta: 0, bit: NORTH, opposite: SOUTH },
  { rowDelta: 0, colDelta: 1, bit: EAST, opposite: WEST },
  { rowDelta: 1, colDelta: 0, bit: SOUTH, opposite: NORTH },
  { rowDelta: 0, colDelta: -1, bit: WEST, opposite: EAST },
] as const;

export const DIFFICULTIES: readonly DifficultyConfig[] = [
  {
    id: 'easy',
    label: 'Easy',
    size: 4,
    branchSteps: 4,
    scoreBase: 5000,
    timeBonus: 18,
    movePenalty: 12,
    roundTimeSeconds: 70,
    minRoundTimeSeconds: 38,
  },
  {
    id: 'normal',
    label: 'Normal',
    size: 5,
    branchSteps: 8,
    scoreBase: 8500,
    timeBonus: 22,
    movePenalty: 15,
    roundTimeSeconds: 62,
    minRoundTimeSeconds: 32,
  },
  {
    id: 'hard',
    label: 'Hard',
    size: 6,
    branchSteps: 14,
    scoreBase: 13000,
    timeBonus: 26,
    movePenalty: 18,
    roundTimeSeconds: 54,
    minRoundTimeSeconds: 28,
  },
] as const;

export function createInitialState(
  difficultyId: DifficultyId = 'normal',
  seed = Date.now(),
  round = 1,
  score = 0,
  failures = 0,
): CircuitState {
  const difficulty = getDifficulty(difficultyId);
  const random = createSeededRandom(seed);
  const solutionMasks = createSolutionMasks(difficulty.size, difficulty.branchSteps, random);
  let board = createScrambledBoard(solutionMasks, random);
  const safeRound = Math.max(1, Math.floor(round));
  const roundTimeSeconds = getRoundTimeSeconds(difficulty, safeRound);

  if (isBoardSolved(board)) {
    board = forceUnsolved(board);
  }

  return {
    difficulty,
    board,
    round: safeRound,
    score,
    failures,
    moves: 0,
    elapsedSeconds: 0,
    remainingSeconds: roundTimeSeconds,
    roundTimeSeconds,
    seed,
  };
}

export function getDifficulty(difficultyId: DifficultyId): DifficultyConfig {
  const difficulty = DIFFICULTIES.find((entry) => entry.id === difficultyId);

  if (!difficulty) {
    throw new Error(`Unknown difficulty: ${difficultyId}`);
  }

  return difficulty;
}

export function createSeededRandom(seed: number): RandomSource {
  let value = Math.trunc(seed) >>> 0;

  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

export function rotateMask(mask: number, turns = 1): number {
  let result = mask & 0b1111;
  const normalizedTurns = ((Math.trunc(turns) % 4) + 4) % 4;

  for (let index = 0; index < normalizedTurns; index += 1) {
    result = ((result << 1) & 0b1110) | ((result & WEST) === WEST ? NORTH : 0);
  }

  return result;
}

export function rotateCell(state: CircuitState, row: number, col: number): CircuitState {
  if (!isInsideBoard(state.board, row, col) || state.board[row]?.[col]?.solutionMask === EMPTY_MASK) {
    return state;
  }

  return {
    ...state,
    board: state.board.map((boardRow, rowIndex) => (
      boardRow.map((cell, colIndex) => (
        rowIndex === row && colIndex === col
          ? { ...cell, mask: rotateMask(cell.mask) }
          : cell
      ))
    )),
    moves: state.moves + 1,
  };
}

export function tickTimer(state: CircuitState, seconds = 1): CircuitState {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return state;
  }

  return {
    ...state,
    remainingSeconds: Math.max(0, state.remainingSeconds - seconds),
    elapsedSeconds: state.elapsedSeconds + seconds,
  };
}

export function advanceRound(state: CircuitState, seed = state.seed + state.round * 7919): CircuitState {
  const roundScore = calculateRoundScore({
    difficultyId: state.difficulty.id,
    round: state.round,
    moves: state.moves,
    remainingSeconds: state.remainingSeconds,
    activeCells: countActiveCells(state.board),
  });

  return createInitialState(
    state.difficulty.id,
    seed,
    state.round + 1,
    state.score + roundScore,
    state.failures,
  );
}

export function recordFailure(state: CircuitState): CircuitState {
  return {
    ...state,
    failures: state.failures + 1,
    remainingSeconds: 0,
  };
}

export function createSolutionBoard(board: CircuitBoard): CircuitBoard {
  return board.map((row) => row.map((cell) => ({
    ...cell,
    mask: cell.solutionMask,
  })));
}

export function getPoweredKeys(board: CircuitBoard): ReadonlySet<string> {
  const powered = new Set<string>();

  if (board.length === 0 || board[0]?.length === 0 || board[0][0]?.mask === EMPTY_MASK) {
    return powered;
  }

  const queue: Position[] = [{ row: 0, col: 0 }];
  powered.add(createCellKey(0, 0));

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      break;
    }

    const currentCell = board[current.row]?.[current.col];

    if (!currentCell) {
      continue;
    }

    for (const direction of DIRECTIONS) {
      if ((currentCell.mask & direction.bit) !== direction.bit) {
        continue;
      }

      const nextRow = current.row + direction.rowDelta;
      const nextCol = current.col + direction.colDelta;
      const nextCell = board[nextRow]?.[nextCol];

      if (!nextCell || (nextCell.mask & direction.opposite) !== direction.opposite) {
        continue;
      }

      const key = createCellKey(nextRow, nextCol);

      if (!powered.has(key)) {
        powered.add(key);
        queue.push({ row: nextRow, col: nextCol });
      }
    }
  }

  return powered;
}

export function countActiveCells(board: CircuitBoard): number {
  return board.reduce((total, row) => (
    total + row.filter((cell) => cell.solutionMask !== EMPTY_MASK).length
  ), 0);
}

export function isSolved(state: CircuitState): boolean {
  return isBoardSolved(state.board);
}

export function isTimedOut(state: CircuitState): boolean {
  return state.remainingSeconds <= 0;
}

export function isBoardSolved(board: CircuitBoard): boolean {
  const activeCount = countActiveCells(board);
  const poweredKeys = getPoweredKeys(board);
  const goal = board[board.length - 1]?.[board.length - 1];

  return activeCount > 0
    && poweredKeys.size === activeCount
    && Boolean(goal && poweredKeys.has(createCellKey(goal.row, goal.col)));
}

export function calculateRoundScore(input: RoundScoreInput): number {
  const difficulty = getDifficulty(input.difficultyId);
  const rawScore = difficulty.scoreBase
    + input.round * 150
    + input.activeCells * 35
    + Math.floor(input.remainingSeconds) * difficulty.timeBonus
    - input.moves * difficulty.movePenalty;

  return Math.max(100, rawScore);
}

export function getRoundTimeSeconds(difficulty: DifficultyConfig, round: number): number {
  const safeRound = Math.max(1, Math.floor(round));

  return Math.max(difficulty.minRoundTimeSeconds, difficulty.roundTimeSeconds - (safeRound - 1) * 2);
}

export function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  return `${minutes}:${restSeconds.toString().padStart(2, '0')}`;
}

export function createCellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function createSolutionMasks(size: number, branchSteps: number, random: RandomSource): number[][] {
  const masks = createMaskGrid(size);
  const connectedCells: Position[] = [{ row: 0, col: 0 }];
  let current: Position = { row: 0, col: 0 };

  while (current.row !== size - 1 || current.col !== size - 1) {
    const options = [
      current.row < size - 1 ? { row: current.row + 1, col: current.col } : null,
      current.col < size - 1 ? { row: current.row, col: current.col + 1 } : null,
    ].filter((position): position is Position => position !== null);
    const next = chooseRandom(options, random);

    connectCells(masks, current, next);
    current = next;
    connectedCells.push(current);
  }

  for (let branchIndex = 0; branchIndex < branchSteps; branchIndex += 1) {
    let cursor = chooseRandom(connectedCells, random);
    const branchLength = 1 + Math.floor(random() * 3);

    for (let step = 0; step < branchLength; step += 1) {
      const options = getUnvisitedNeighbors(masks, cursor);

      if (options.length === 0) {
        break;
      }

      const next = chooseRandom(options, random);
      connectCells(masks, cursor, next);
      cursor = next;
      connectedCells.push(cursor);
    }
  }

  return masks;
}

function createMaskGrid(size: number): number[][] {
  if (!Number.isInteger(size) || size < 2) {
    throw new Error('size must be an integer greater than 1.');
  }

  return Array.from({ length: size }, () => Array.from({ length: size }, () => EMPTY_MASK));
}

function createScrambledBoard(solutionMasks: readonly (readonly number[])[], random: RandomSource): CircuitBoard {
  const size = solutionMasks.length;

  return solutionMasks.map((row, rowIndex) => row.map((solutionMask, colIndex) => {
    const randomTurns = solutionMask === EMPTY_MASK ? 0 : Math.floor(random() * 4);

    return {
      row: rowIndex,
      col: colIndex,
      mask: rotateMask(solutionMask, randomTurns),
      solutionMask,
      isSource: rowIndex === 0 && colIndex === 0,
      isGoal: rowIndex === size - 1 && colIndex === size - 1,
    };
  }));
}

function forceUnsolved(board: CircuitBoard): CircuitBoard {
  return board.map((row) => row.map((cell) => {
    if (cell.solutionMask === EMPTY_MASK || rotateMask(cell.mask) === cell.mask) {
      return cell;
    }

    return {
      ...cell,
      mask: rotateMask(cell.mask),
    };
  }));
}

function connectCells(masks: number[][], from: Position, to: Position): void {
  const direction = DIRECTIONS.find((entry) => (
    from.row + entry.rowDelta === to.row && from.col + entry.colDelta === to.col
  ));

  if (!direction) {
    throw new Error('Cells must be adjacent to connect.');
  }

  const fromMask = masks[from.row]?.[from.col];
  const toMask = masks[to.row]?.[to.col];

  if (fromMask === undefined || toMask === undefined) {
    throw new Error('Cannot connect cells outside the board.');
  }

  masks[from.row][from.col] = fromMask | direction.bit;
  masks[to.row][to.col] = toMask | direction.opposite;
}

function getUnvisitedNeighbors(masks: readonly (readonly number[])[], position: Position): readonly Position[] {
  return DIRECTIONS.map((direction) => ({
    row: position.row + direction.rowDelta,
    col: position.col + direction.colDelta,
  })).filter((next) => (
    next.row >= 0
    && next.row < masks.length
    && next.col >= 0
    && next.col < masks.length
    && masks[next.row]?.[next.col] === EMPTY_MASK
  ));
}

function isInsideBoard(board: CircuitBoard, row: number, col: number): boolean {
  return row >= 0 && row < board.length && col >= 0 && col < board.length;
}

function chooseRandom<TValue>(items: readonly TValue[], random: RandomSource): TValue {
  if (items.length === 0) {
    throw new Error('Cannot choose from an empty array.');
  }

  return items[Math.floor(random() * items.length)] as TValue;
}
