export type Direction = 'up' | 'right' | 'down' | 'left';
export type GamePhase = 'ready' | 'playing' | 'paused' | 'game-over' | 'won';
export type RandomSource = () => number;

export interface Position {
  readonly row: number;
  readonly column: number;
}

export interface SnakeState {
  readonly gridSize: number;
  readonly phase: GamePhase;
  readonly snake: readonly Position[];
  readonly direction: Direction;
  readonly pendingDirection: Direction;
  readonly food: Position;
  readonly score: number;
  readonly bestScore: number;
  readonly moveCount: number;
}

export const GRID_SIZE = 15;
export const SCORE_PER_FOOD = 10;
export const SPEED_UP_EVERY = 5;
export const INITIAL_STEP_MS = 170;
export const MIN_STEP_MS = 70;

export function createGameState(
  random: RandomSource = Math.random,
  bestScore = 0,
): SnakeState {
  const center = Math.floor(GRID_SIZE / 2);
  const snake: readonly Position[] = [
    { row: center, column: center + 1 },
    { row: center, column: center },
    { row: center, column: center - 1 },
  ];

  return {
    gridSize: GRID_SIZE,
    phase: 'ready',
    snake,
    direction: 'right',
    pendingDirection: 'right',
    food: spawnFood(GRID_SIZE, snake, random),
    score: 0,
    bestScore,
    moveCount: 0,
  };
}

export function startGame(state: SnakeState): SnakeState {
  if (state.phase === 'game-over' || state.phase === 'won') {
    return state;
  }

  return {
    ...state,
    phase: 'playing',
  };
}

export function pauseGame(state: SnakeState): SnakeState {
  if (state.phase !== 'playing') {
    return state;
  }

  return {
    ...state,
    phase: 'paused',
  };
}

export function queueDirection(state: SnakeState, direction: Direction): SnakeState {
  if (isOppositeDirection(state.direction, direction)) {
    return state;
  }

  return {
    ...state,
    pendingDirection: direction,
  };
}

export function stepGame(
  state: SnakeState,
  random: RandomSource = Math.random,
): SnakeState {
  if (state.phase !== 'playing') {
    return state;
  }

  const nextDirection = state.pendingDirection;
  const head = getHead(state);
  const nextHead = movePosition(head, nextDirection);
  const willEat = positionsEqual(nextHead, state.food);
  const nextBodyWithoutTail = willEat ? state.snake : state.snake.slice(0, -1);

  if (
    isOutOfBounds(nextHead, state.gridSize) ||
    nextBodyWithoutTail.some((part) => positionsEqual(part, nextHead))
  ) {
    return {
      ...state,
      phase: 'game-over',
      direction: nextDirection,
      pendingDirection: nextDirection,
      bestScore: Math.max(state.bestScore, state.score),
    };
  }

  const snake = [nextHead, ...state.snake];
  const nextSnake = willEat ? snake : snake.slice(0, -1);
  const score = willEat ? state.score + SCORE_PER_FOOD : state.score;
  const phase = nextSnake.length === state.gridSize * state.gridSize ? 'won' : 'playing';

  return {
    ...state,
    phase,
    snake: nextSnake,
    direction: nextDirection,
    pendingDirection: nextDirection,
    food: willEat ? spawnFood(state.gridSize, nextSnake, random) : state.food,
    score,
    bestScore: Math.max(state.bestScore, score),
    moveCount: state.moveCount + 1,
  };
}

export function spawnFood(
  gridSize: number,
  snake: readonly Position[],
  random: RandomSource = Math.random,
): Position {
  const emptyCells: Position[] = [];

  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const position = { row, column };

      if (!snake.some((part) => positionsEqual(part, position))) {
        emptyCells.push(position);
      }
    }
  }

  if (emptyCells.length === 0) {
    return getHead({ snake } as Pick<SnakeState, 'snake'>);
  }

  const selectedIndex = Math.min(emptyCells.length - 1, Math.floor(random() * emptyCells.length));
  const food = emptyCells[selectedIndex];

  if (!food) {
    throw new Error('Unable to select food position.');
  }

  return food;
}

export function getStepDurationMs(score: number): number {
  const speedLevel = getSpeedLevel(score);
  return Math.max(MIN_STEP_MS, INITIAL_STEP_MS - (speedLevel - 1) * 12);
}

export function getSpeedLevel(score: number): number {
  return Math.floor(score / (SCORE_PER_FOOD * SPEED_UP_EVERY)) + 1;
}

export function getKeyboardDirection(key: string): Direction | null {
  const keyMap: Record<string, Direction> = {
    ArrowUp: 'up',
    KeyW: 'up',
    w: 'up',
    W: 'up',
    ArrowRight: 'right',
    KeyD: 'right',
    d: 'right',
    D: 'right',
    ArrowDown: 'down',
    KeyS: 'down',
    s: 'down',
    S: 'down',
    ArrowLeft: 'left',
    KeyA: 'left',
    a: 'left',
    A: 'left',
  };

  return keyMap[key] ?? null;
}

export function positionsEqual(first: Position, second: Position): boolean {
  return first.row === second.row && first.column === second.column;
}

export function getCellKey(position: Position): string {
  return `${position.row}:${position.column}`;
}

function getHead(state: Pick<SnakeState, 'snake'>): Position {
  const head = state.snake[0];

  if (!head) {
    throw new Error('Snake must contain at least one segment.');
  }

  return head;
}

function movePosition(position: Position, direction: Direction): Position {
  if (direction === 'up') {
    return {
      row: position.row - 1,
      column: position.column,
    };
  }

  if (direction === 'right') {
    return {
      row: position.row,
      column: position.column + 1,
    };
  }

  if (direction === 'down') {
    return {
      row: position.row + 1,
      column: position.column,
    };
  }

  return {
    row: position.row,
    column: position.column - 1,
  };
}

function isOutOfBounds(position: Position, gridSize: number): boolean {
  return (
    position.row < 0 ||
    position.column < 0 ||
    position.row >= gridSize ||
    position.column >= gridSize
  );
}

function isOppositeDirection(current: Direction, next: Direction): boolean {
  return (
    (current === 'up' && next === 'down') ||
    (current === 'down' && next === 'up') ||
    (current === 'left' && next === 'right') ||
    (current === 'right' && next === 'left')
  );
}
