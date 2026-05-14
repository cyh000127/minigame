export type DifficultyId = 'easy' | 'normal' | 'hard';
export type RandomSource = () => number;
export type DirectionId = 'up' | 'right' | 'down' | 'left';
export type TileKind = 'wall' | 'floor';

export interface DifficultyConfig {
  readonly id: DifficultyId;
  readonly label: string;
  readonly size: number;
  readonly wallRate: number;
  readonly collectibleCount: number;
  readonly roundTimeSeconds: number;
  readonly minRoundTimeSeconds: number;
  readonly scoreBase: number;
  readonly timeBonus: number;
  readonly stepPenalty: number;
}

export interface Position {
  readonly row: number;
  readonly col: number;
}

export interface MazeCell {
  readonly row: number;
  readonly col: number;
  readonly kind: TileKind;
}

export type MazeBoard = readonly (readonly MazeCell[])[];

export interface MazeState {
  readonly difficulty: DifficultyConfig;
  readonly board: MazeBoard;
  readonly player: Position;
  readonly exit: Position;
  readonly collectibles: readonly Position[];
  readonly collectedKeys: readonly string[];
  readonly steps: number;
  readonly elapsedSeconds: number;
  readonly remainingSeconds: number;
  readonly roundTimeSeconds: number;
  readonly round: number;
  readonly score: number;
  readonly failures: number;
  readonly seed: number;
}

export interface RoundScoreInput {
  readonly difficultyId: DifficultyId;
  readonly round: number;
  readonly remainingSeconds: number;
  readonly collectedCount: number;
  readonly steps: number;
}

interface GenerationResult {
  readonly board: MazeBoard;
  readonly player: Position;
  readonly exit: Position;
  readonly collectibles: readonly Position[];
}

export const DIRECTIONS: readonly { readonly id: DirectionId; readonly rowDelta: number; readonly colDelta: number }[] = [
  { id: 'up', rowDelta: -1, colDelta: 0 },
  { id: 'right', rowDelta: 0, colDelta: 1 },
  { id: 'down', rowDelta: 1, colDelta: 0 },
  { id: 'left', rowDelta: 0, colDelta: -1 },
] as const;

export const DIFFICULTIES: readonly DifficultyConfig[] = [
  {
    id: 'easy',
    label: 'Easy',
    size: 7,
    wallRate: 0.18,
    collectibleCount: 2,
    roundTimeSeconds: 60,
    minRoundTimeSeconds: 38,
    scoreBase: 2000,
    timeBonus: 18,
    stepPenalty: 10,
  },
  {
    id: 'normal',
    label: 'Normal',
    size: 9,
    wallRate: 0.24,
    collectibleCount: 3,
    roundTimeSeconds: 72,
    minRoundTimeSeconds: 48,
    scoreBase: 3200,
    timeBonus: 22,
    stepPenalty: 12,
  },
  {
    id: 'hard',
    label: 'Hard',
    size: 11,
    wallRate: 0.28,
    collectibleCount: 4,
    roundTimeSeconds: 84,
    minRoundTimeSeconds: 56,
    scoreBase: 4800,
    timeBonus: 26,
    stepPenalty: 14,
  },
] as const;

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

export function createInitialState(
  difficultyId: DifficultyId = 'normal',
  seed = Date.now(),
  round = 1,
  score = 0,
  failures = 0,
): MazeState {
  const difficulty = getDifficulty(difficultyId);
  const safeRound = Math.max(1, Math.floor(round));
  const random = createSeededRandom(seed);
  const generated = generateStage(difficulty, random);
  const roundTimeSeconds = getRoundTimeSeconds(difficulty, safeRound);

  return {
    difficulty,
    board: generated.board,
    player: generated.player,
    exit: generated.exit,
    collectibles: generated.collectibles,
    collectedKeys: [],
    steps: 0,
    elapsedSeconds: 0,
    remainingSeconds: roundTimeSeconds,
    roundTimeSeconds,
    round: safeRound,
    score,
    failures,
    seed,
  };
}

export function movePlayer(state: MazeState, directionId: DirectionId): MazeState {
  const direction = DIRECTIONS.find((entry) => entry.id === directionId);

  if (!direction) {
    return state;
  }

  const nextPosition = {
    row: state.player.row + direction.rowDelta,
    col: state.player.col + direction.colDelta,
  };

  if (!isWalkable(state.board, nextPosition)) {
    return state;
  }

  const collectibleKeys = state.collectibles.map(createPositionKey);

  return {
    ...state,
    player: nextPosition,
    collectedKeys: collectAt(state.collectedKeys, nextPosition, collectibleKeys),
    steps: state.steps + 1,
  };
}

export function tickTimer(state: MazeState, seconds = 1): MazeState {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return state;
  }

  return {
    ...state,
    elapsedSeconds: state.elapsedSeconds + seconds,
    remainingSeconds: Math.max(0, state.remainingSeconds - seconds),
  };
}

export function canExit(state: MazeState): boolean {
  return state.collectedKeys.length === state.collectibles.length
    && state.player.row === state.exit.row
    && state.player.col === state.exit.col;
}

export function isTimedOut(state: MazeState): boolean {
  return state.remainingSeconds <= 0;
}

export function advanceRound(state: MazeState, seed = state.seed + state.round * 6151): MazeState {
  const roundScore = calculateRoundScore({
    difficultyId: state.difficulty.id,
    round: state.round,
    remainingSeconds: state.remainingSeconds,
    collectedCount: state.collectibles.length,
    steps: state.steps,
  });

  return createInitialState(
    state.difficulty.id,
    seed,
    state.round + 1,
    state.score + roundScore,
    state.failures,
  );
}

export function recordFailure(state: MazeState): MazeState {
  return {
    ...state,
    failures: state.failures + 1,
    remainingSeconds: 0,
  };
}

export function calculateRoundScore(input: RoundScoreInput): number {
  const difficulty = getDifficulty(input.difficultyId);
  const rawScore = difficulty.scoreBase
    + input.round * 180
    + input.collectedCount * 220
    + Math.floor(input.remainingSeconds) * difficulty.timeBonus
    - input.steps * difficulty.stepPenalty;

  return Math.max(200, rawScore);
}

export function getRoundTimeSeconds(difficulty: DifficultyConfig, round: number): number {
  const safeRound = Math.max(1, Math.floor(round));

  return Math.max(difficulty.minRoundTimeSeconds, difficulty.roundTimeSeconds - (safeRound - 1) * 2);
}

export function countRemainingCollectibles(state: MazeState): number {
  return state.collectibles.length - state.collectedKeys.length;
}

export function createPositionKey(position: Position): string {
  return `${position.row}:${position.col}`;
}

function generateStage(difficulty: DifficultyConfig, random: RandomSource): GenerationResult {
  const player: Position = { row: 0, col: 0 };
  const exit: Position = { row: difficulty.size - 1, col: difficulty.size - 1 };
  const protectedKeys = new Set<string>([createPositionKey(player), createPositionKey(exit)]);

  while (true) {
    const board = createBoard(difficulty, random, protectedKeys);
    const reachable = bfsReachable(board, player);
    const collectibles = chooseCollectibles(reachable, difficulty.collectibleCount, random, protectedKeys);

    if (collectibles.length !== difficulty.collectibleCount) {
      continue;
    }

    const reachableKeys = new Set(reachable.map(createPositionKey));

    if (!reachableKeys.has(createPositionKey(exit))) {
      continue;
    }

    if (collectibles.every((position) => reachableKeys.has(createPositionKey(position)))) {
      return {
        board,
        player,
        exit,
        collectibles,
      };
    }
  }
}

function createBoard(
  difficulty: DifficultyConfig,
  random: RandomSource,
  protectedKeys: ReadonlySet<string>,
): MazeBoard {
  return Array.from({ length: difficulty.size }, (_, row) => (
    Array.from({ length: difficulty.size }, (_, col) => {
      const key = createPositionKey({ row, col });
      const isWall = !protectedKeys.has(key) && random() < difficulty.wallRate;

      return {
        row,
        col,
        kind: isWall ? 'wall' : 'floor',
      } satisfies MazeCell;
    })
  ));
}

function bfsReachable(board: MazeBoard, start: Position): readonly Position[] {
  const queue: Position[] = [start];
  const visited = new Set<string>([createPositionKey(start)]);
  const reachable: Position[] = [start];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      break;
    }

    for (const direction of DIRECTIONS) {
      const next = {
        row: current.row + direction.rowDelta,
        col: current.col + direction.colDelta,
      };
      const key = createPositionKey(next);

      if (!isWalkable(board, next) || visited.has(key)) {
        continue;
      }

      visited.add(key);
      queue.push(next);
      reachable.push(next);
    }
  }

  return reachable;
}

function chooseCollectibles(
  reachable: readonly Position[],
  count: number,
  random: RandomSource,
  protectedKeys: ReadonlySet<string>,
): readonly Position[] {
  const candidates = shuffle(
    reachable.filter((position) => !protectedKeys.has(createPositionKey(position))),
    random,
  );

  return candidates.slice(0, count);
}

function shuffle<TValue>(items: readonly TValue[], random: RandomSource): TValue[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = result[index];
    const swap = result[swapIndex];

    if (current === undefined || swap === undefined) {
      continue;
    }

    result[index] = swap;
    result[swapIndex] = current;
  }

  return result;
}

function isWalkable(board: MazeBoard, position: Position): boolean {
  return board[position.row]?.[position.col]?.kind === 'floor';
}

function collectAt(
  collectedKeys: readonly string[],
  position: Position,
  collectibleKeys: readonly string[],
): readonly string[] {
  const key = createPositionKey(position);

  if (!collectibleKeys.includes(key) || collectedKeys.includes(key)) {
    return collectedKeys;
  }

  return [...collectedKeys, key];
}
