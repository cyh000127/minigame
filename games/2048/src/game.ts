export type Direction = 'up' | 'right' | 'down' | 'left';
export type GameStatus = 'playing' | 'won' | 'game-over';
export type Board = readonly number[];
export type RandomSource = () => number;

export interface GameState {
  readonly board: Board;
  readonly score: number;
  readonly bestScore: number;
  readonly status: GameStatus;
  readonly hasWon: boolean;
  readonly moveCount: number;
}

export interface MoveResult {
  readonly board: Board;
  readonly scoreGain: number;
  readonly moved: boolean;
}

export const BOARD_SIZE = 4;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const WIN_TILE = 2048;

export function createEmptyBoard(): Board {
  return Array.from({ length: CELL_COUNT }, () => 0);
}

export function createGameState(
  random: RandomSource = Math.random,
  bestScore = 0,
): GameState {
  const boardWithFirstTile = spawnRandomTile(createEmptyBoard(), random);
  const board = spawnRandomTile(boardWithFirstTile, random);

  return {
    board,
    score: 0,
    bestScore,
    status: 'playing',
    hasWon: false,
    moveCount: 0,
  };
}

export function applyMove(
  state: GameState,
  direction: Direction,
  random: RandomSource = Math.random,
): GameState {
  if (state.status !== 'playing') {
    return state;
  }

  const movedBoard = moveBoard(state.board, direction);

  if (!movedBoard.moved) {
    return state;
  }

  const nextBoard = spawnRandomTile(movedBoard.board, random);
  const score = state.score + movedBoard.scoreGain;
  const hasJustWon = !state.hasWon && getMaxTile(nextBoard) >= WIN_TILE;
  const hasWon = state.hasWon || hasJustWon;
  const status = getNextStatus(nextBoard, hasJustWon);

  return {
    board: nextBoard,
    score,
    bestScore: Math.max(state.bestScore, score),
    status,
    hasWon,
    moveCount: state.moveCount + 1,
  };
}

export function continueAfterWin(state: GameState): GameState {
  if (state.status !== 'won') {
    return state;
  }

  return {
    ...state,
    status: canMove(state.board) ? 'playing' : 'game-over',
    hasWon: true,
  };
}

export function moveBoard(board: Board, direction: Direction): MoveResult {
  const nextBoard = createEmptyBoard() as number[];
  let scoreGain = 0;

  for (let line = 0; line < BOARD_SIZE; line += 1) {
    const indexes = getLineIndexes(direction, line);
    const values = indexes.map((index) => getCell(board, index));
    const movedLine = slideLine(values);

    scoreGain += movedLine.scoreGain;

    for (let position = 0; position < BOARD_SIZE; position += 1) {
      const targetIndex = getCellIndex(indexes, position);
      nextBoard[targetIndex] = movedLine.values[position] ?? 0;
    }
  }

  return {
    board: nextBoard,
    scoreGain,
    moved: !boardsEqual(board, nextBoard),
  };
}

export function slideLine(values: readonly number[]): { readonly values: readonly number[]; readonly scoreGain: number } {
  const tiles = values.filter((value) => value > 0);
  const result: number[] = [];
  let scoreGain = 0;
  let index = 0;

  while (index < tiles.length) {
    const current = tiles[index] ?? 0;
    const next = tiles[index + 1] ?? 0;

    if (current > 0 && current === next) {
      const mergedValue = current * 2;
      result.push(mergedValue);
      scoreGain += mergedValue;
      index += 2;
      continue;
    }

    result.push(current);
    index += 1;
  }

  while (result.length < BOARD_SIZE) {
    result.push(0);
  }

  return {
    values: result,
    scoreGain,
  };
}

export function spawnRandomTile(
  board: Board,
  random: RandomSource = Math.random,
): Board {
  const emptyIndexes = getEmptyIndexes(board);

  if (emptyIndexes.length === 0) {
    return board;
  }

  const selectedEmptyIndex = Math.min(
    emptyIndexes.length - 1,
    Math.floor(random() * emptyIndexes.length),
  );
  const boardIndex = emptyIndexes[selectedEmptyIndex];

  if (boardIndex === undefined) {
    return board;
  }

  const value = random() < 0.9 ? 2 : 4;
  const nextBoard = [...board];
  nextBoard[boardIndex] = value;

  return nextBoard;
}

export function canMove(board: Board): boolean {
  if (getEmptyIndexes(board).length > 0) {
    return true;
  }

  for (let index = 0; index < CELL_COUNT; index += 1) {
    const value = getCell(board, index);
    const rightIndex = getRightNeighborIndex(index);
    const downIndex = getDownNeighborIndex(index);

    if (rightIndex !== null && getCell(board, rightIndex) === value) {
      return true;
    }

    if (downIndex !== null && getCell(board, downIndex) === value) {
      return true;
    }
  }

  return false;
}

export function getMaxTile(board: Board): number {
  return board.reduce((maxValue, value) => Math.max(maxValue, value), 0);
}

export function getCell(board: Board, index: number): number {
  return board[index] ?? 0;
}

export function boardsEqual(first: Board, second: Board): boolean {
  if (first.length !== second.length) {
    return false;
  }

  return first.every((value, index) => value === getCell(second, index));
}

export function getEmptyIndexes(board: Board): readonly number[] {
  const indexes: number[] = [];

  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (getCell(board, index) === 0) {
      indexes.push(index);
    }
  }

  return indexes;
}

function getLineIndexes(direction: Direction, line: number): readonly number[] {
  const indexes: number[] = [];

  for (let offset = 0; offset < BOARD_SIZE; offset += 1) {
    if (direction === 'left') {
      indexes.push(line * BOARD_SIZE + offset);
    }

    if (direction === 'right') {
      indexes.push(line * BOARD_SIZE + (BOARD_SIZE - 1 - offset));
    }

    if (direction === 'up') {
      indexes.push(offset * BOARD_SIZE + line);
    }

    if (direction === 'down') {
      indexes.push((BOARD_SIZE - 1 - offset) * BOARD_SIZE + line);
    }
  }

  return indexes;
}

function getCellIndex(indexes: readonly number[], position: number): number {
  const index = indexes[position];

  if (index === undefined) {
    throw new Error(`Invalid board position: ${position}`);
  }

  return index;
}

function getRightNeighborIndex(index: number): number | null {
  return index % BOARD_SIZE === BOARD_SIZE - 1 ? null : index + 1;
}

function getDownNeighborIndex(index: number): number | null {
  return index >= CELL_COUNT - BOARD_SIZE ? null : index + BOARD_SIZE;
}

function getNextStatus(board: Board, hasJustWon: boolean): GameStatus {
  if (hasJustWon) {
    return 'won';
  }

  return canMove(board) ? 'playing' : 'game-over';
}
